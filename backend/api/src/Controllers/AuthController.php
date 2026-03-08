<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Support\ApiException;
use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;
use PDO;

class AuthController
{
    public function __construct(
        private readonly PDO $db,
        private readonly Auth $auth
    ) {
    }

    public function register(Request $request): never
    {
        $payload = $request->all();
        $fullName = trim((string) ($payload['full_name'] ?? ''));
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $phone = trim((string) ($payload['phone'] ?? ''));
        $role = strtolower(trim((string) ($payload['role'] ?? 'staff')));
        $password = (string) ($payload['password'] ?? '');

        $errors = [];
        if ($fullName === '') {
            $errors['full_name'][] = 'Full name is required.';
        }
        if ($email === '') {
            $errors['email'][] = 'Email is required.';
        }
        if (!in_array($role, ['admin', 'staff'], true)) {
            $errors['role'][] = 'Role must be admin or staff.';
        }
        if (strlen($password) < 8) {
            $errors['password'][] = 'Password must be at least 8 characters.';
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        $exists = $this->db->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $exists->execute(['email' => $email]);
        if ($exists->fetch()) {
            throw new ApiException('Email already exists.', 422, ['email' => ['Email already exists.']]);
        }

        $stmt = $this->db->prepare(
            'INSERT INTO users (full_name, email, phone, password_hash, role, status, created_at, updated_at)
             VALUES (:full_name, :email, :phone, :password_hash, :role, "active", NOW(), NOW())'
        );
        $stmt->execute([
            'full_name' => $fullName,
            'email' => $email,
            'phone' => $phone !== '' ? $phone : null,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => $role,
        ]);

        Response::success([
            'message' => 'User account created successfully.',
            'data' => [
                'id' => (int) $this->db->lastInsertId(),
                'full_name' => $fullName,
                'email' => $email,
                'phone' => $phone,
                'role' => $role,
                'status' => 'active',
            ],
        ], 201);
    }

    public function users(Request $request): never
    {
        $user = $this->auth->requireUser($request);
        if (($user['role'] ?? '') !== 'admin') {
            throw new ApiException('Only admins can view user accounts.', 403);
        }

        $role = strtolower(trim((string) ($request->query('role') ?? '')));
        $search = strtolower(trim((string) ($request->query('search') ?? '')));

        $sql = 'SELECT id, full_name, email, phone, role, status, created_at
                FROM users
                WHERE 1=1';
        $params = [];

        if (in_array($role, ['admin', 'staff'], true)) {
            $sql .= ' AND role = :role';
            $params['role'] = $role;
        }

        if ($search !== '') {
            $sql .= ' AND (LOWER(full_name) LIKE :search OR LOWER(email) LIKE :search OR LOWER(COALESCE(phone, "")) LIKE :search)';
            $params['search'] = '%' . $search . '%';
        }

        $sql .= ' ORDER BY created_at DESC, id DESC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        Response::success([
            'data' => array_map(static function (array $row): array {
                return [
                    'id' => (int) $row['id'],
                    'full_name' => $row['full_name'],
                    'email' => $row['email'],
                    'phone' => $row['phone'],
                    'role' => $row['role'],
                    'status' => $row['status'],
                    'created_at' => $row['created_at'],
                ];
            }, $items),
        ]);
    }

    public function login(Request $request): never
    {
        $payload = $request->all();
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $phone = trim((string) ($payload['phone'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $identifier = $email !== '' ? $email : $phone;

        if ($identifier === '' || $password === '') {
            throw new ApiException('Email or phone and password are required.', 422, [
                'email' => ['Email or phone is required.'],
                'password' => ['Password is required.'],
            ]);
        }

        $stmt = $this->db->prepare(
            'SELECT * FROM users WHERE email = :email_identifier OR phone = :phone_identifier LIMIT 1'
        );
        $stmt->execute([
            'email_identifier' => $identifier,
            'phone_identifier' => $identifier,
        ]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, (string) $user['password_hash'])) {
            throw new ApiException('Invalid credentials.', 401);
        }

        if (($user['status'] ?? 'inactive') !== 'active') {
            throw new ApiException('Account is not active.', 401);
        }

        $token = $this->auth->issueToken((int) $user['id']);

        Response::success([
            'message' => 'Login successful.',
            'data' => [
                'token' => $token['token'],
                'token_type' => 'Bearer',
                'expires_at' => $token['expires_at'],
                'user' => [
                    'id' => (int) $user['id'],
                    'full_name' => $user['full_name'],
                    'email' => $user['email'],
                    'phone' => $user['phone'],
                    'role' => $user['role'],
                    'status' => $user['status'],
                ],
            ],
        ]);
    }
}
