<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Support\ApiException;
use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;
use PDO;

class PackagingSizeController
{
    public function __construct(
        private readonly PDO $db,
        private readonly Auth $auth
    ) {
    }

    public function index(Request $request): never
    {
        $this->auth->requireUser($request);
        $stmt = $this->db->query('SELECT * FROM packaging_sizes ORDER BY volume_liters ASC, name ASC');
        Response::success(['data' => $stmt->fetchAll()]);
    }

    public function store(Request $request): never
    {
        $this->auth->requireRole($request, ['admin']);
        $payload = $this->validate($request->all());
        $stmt = $this->db->prepare(
            'INSERT INTO packaging_sizes
             (name, code, volume_liters, bottle_cost, cap_cost, label_cost, extra_packaging_cost, default_selling_price, status, created_at, updated_at)
             VALUES
             (:name, :code, :volume_liters, :bottle_cost, :cap_cost, :label_cost, :extra_packaging_cost, :default_selling_price, :status, NOW(), NOW())'
        );
        $stmt->execute($payload);
        Response::success(['message' => 'Packaging size created successfully.'], 201);
    }

    public function update(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $id = (int) ($params['id'] ?? 0);
        $this->ensureExists($id);
        $payload = $this->validate($request->all(), false);
        $payload['id'] = $id;

        $stmt = $this->db->prepare(
            'UPDATE packaging_sizes
             SET name = :name,
                 code = :code,
                 volume_liters = :volume_liters,
                 bottle_cost = :bottle_cost,
                 cap_cost = :cap_cost,
                 label_cost = :label_cost,
                 extra_packaging_cost = :extra_packaging_cost,
                 default_selling_price = :default_selling_price,
                 status = :status,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute($payload);
        Response::success(['message' => 'Packaging size updated successfully.']);
    }

    public function destroy(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $id = (int) ($params['id'] ?? 0);
        $this->ensureExists($id);

        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM production_batch_packaging_allocations WHERE packaging_size_id = :id'
        );
        $stmt->execute(['id' => $id]);
        if ((int) $stmt->fetchColumn() > 0) {
            throw new ApiException('Cannot delete packaging size already used in production allocations.', 422);
        }

        $delete = $this->db->prepare('DELETE FROM packaging_sizes WHERE id = :id');
        $delete->execute(['id' => $id]);

        Response::success(['message' => 'Packaging size deleted successfully.']);
    }

    private function ensureExists(int $id): void
    {
        $stmt = $this->db->prepare('SELECT id FROM packaging_sizes WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        if (!$stmt->fetch()) {
            throw new ApiException('Packaging size not found.', 404);
        }
    }

    private function validate(array $payload, bool $requireAll = true): array
    {
        $errors = [];
        foreach (['name', 'volume_liters'] as $field) {
            if ($requireAll && (!isset($payload[$field]) || $payload[$field] === '')) {
                $errors[$field][] = ucfirst(str_replace('_', ' ', $field)) . ' is required.';
            }
        }

        $name = trim((string) ($payload['name'] ?? ''));
        $volumeLiters = (float) ($payload['volume_liters'] ?? 0);
        $code = trim((string) ($payload['code'] ?? ''));
        if ($code === '' && $name !== '') {
            $code = strtolower((string) preg_replace('/[^a-z0-9]+/i', '_', $name));
        }

        if ($name === '') {
            $errors['name'][] = 'Name is required.';
        }
        if ($volumeLiters <= 0) {
            $errors['volume_liters'][] = 'Volume liters must be greater than zero.';
        }
        if ($code === '') {
            $errors['code'][] = 'Code is required.';
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        return [
            'name' => $name,
            'code' => $code,
            'volume_liters' => $volumeLiters,
            'bottle_cost' => (float) ($payload['bottle_cost'] ?? 0),
            'cap_cost' => (float) ($payload['cap_cost'] ?? 0),
            'label_cost' => (float) ($payload['label_cost'] ?? 0),
            'extra_packaging_cost' => (float) ($payload['extra_packaging_cost'] ?? 0),
            'default_selling_price' => (float) ($payload['default_selling_price'] ?? 0),
            'status' => trim((string) ($payload['status'] ?? 'active')),
        ];
    }
}
