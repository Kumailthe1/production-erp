<?php

declare(strict_types=1);

namespace App\Support;

use PDO;

class Auth
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function userFromBearer(?string $authorization): ?array
    {
        if (!$authorization || !preg_match('/Bearer\s+(.+)/i', $authorization, $matches)) {
            return null;
        }

        $token = trim($matches[1]);
        $hash = hash('sha256', $token);

        $sql = 'SELECT t.*, u.id AS user_id, u.full_name, u.email, u.phone, u.role, u.status
                FROM access_tokens t
                INNER JOIN users u ON u.id = t.user_id
                WHERE t.token_hash = :token_hash
                  AND t.revoked_at IS NULL
                  AND (t.expires_at IS NULL OR t.expires_at > NOW())
                  AND u.status = "active"
                LIMIT 1';
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['token_hash' => $hash]);
        $record = $stmt->fetch();

        if (!$record) {
            return null;
        }

        $touch = $this->db->prepare('UPDATE access_tokens SET last_used_at = NOW() WHERE id = :id');
        $touch->execute(['id' => $record['id']]);

        return [
            'id' => (int) $record['user_id'],
            'full_name' => $record['full_name'],
            'email' => $record['email'],
            'phone' => $record['phone'],
            'role' => $record['role'],
            'status' => $record['status'],
        ];
    }

    public function requireUser(Request $request): array
    {
        $user = $this->userFromBearer($request->header('Authorization'));
        if (!$user) {
            throw new ApiException('Authentication required.', 401);
        }

        return $user;
    }

    public function requireRole(Request $request, array $roles): array
    {
        $user = $this->requireUser($request);
        if (!in_array($user['role'], $roles, true)) {
            throw new ApiException('You do not have permission to perform this action.', 403);
        }

        return $user;
    }

    public function issueToken(int $userId, string $name = 'api-login'): array
    {
        $plainText = bin2hex(random_bytes(32));
        $hash = hash('sha256', $plainText);
        $ttlHours = (int) env('ACCESS_TOKEN_TTL_HOURS', 12);
        $expiresAt = date('Y-m-d H:i:s', strtotime('+' . $ttlHours . ' hours'));

        $stmt = $this->db->prepare(
            'INSERT INTO access_tokens (user_id, token_name, token_hash, expires_at, created_at)
             VALUES (:user_id, :token_name, :token_hash, :expires_at, NOW())'
        );
        $stmt->execute([
            'user_id' => $userId,
            'token_name' => $name,
            'token_hash' => $hash,
            'expires_at' => $expiresAt,
        ]);

        return [
            'token' => $plainText,
            'expires_at' => $expiresAt,
        ];
    }
}
