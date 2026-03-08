<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\StateRebuildService;
use App\Support\ApiException;
use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;
use PDO;

class DistributorController
{
    public function __construct(
        private readonly PDO $db,
        private readonly Auth $auth,
        private readonly StateRebuildService $state
    ) {
    }

    public function index(Request $request): never
    {
        $this->auth->requireUser($request);
        $stmt = $this->db->query('SELECT * FROM distributors ORDER BY name ASC');
        Response::success(['data' => $stmt->fetchAll()]);
    }

    public function show(Request $request, array $params): never
    {
        $this->auth->requireUser($request);
        $stmt = $this->db->prepare('SELECT * FROM distributors WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => (int) $params['id']]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new ApiException('Distributor not found.', 404);
        }

        Response::success(['data' => $row]);
    }

    public function store(Request $request): never
    {
        $this->auth->requireRole($request, ['admin']);
        $payload = $this->validate($request->all());

        $stmt = $this->db->prepare(
            'INSERT INTO distributors (name, phone, email, address, status, notes, created_at, updated_at)
             VALUES (:name, :phone, :email, :address, :status, :notes, NOW(), NOW())'
        );
        $stmt->execute($payload);

        Response::success([
            'message' => 'Distributor created successfully.',
            'data' => ['id' => (int) $this->db->lastInsertId()] + $payload,
        ], 201);
    }

    public function update(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $payload = $this->validate($request->all());
        $payload['id'] = (int) $params['id'];

        $stmt = $this->db->prepare(
            'UPDATE distributors
             SET name = :name,
                 phone = :phone,
                 email = :email,
                 address = :address,
                 status = :status,
                 notes = :notes,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute($payload);
        if ($stmt->rowCount() === 0) {
            throw new ApiException('Distributor not found.', 404);
        }

        Response::success(['message' => 'Distributor updated successfully.']);
    }

    public function destroy(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $distributorId = (int) $params['id'];
        $exists = $this->db->prepare('SELECT id FROM distributors WHERE id = :id LIMIT 1');
        $exists->execute(['id' => $distributorId]);
        if (!$exists->fetch()) {
            throw new ApiException('Distributor not found.', 404);
        }

        $this->db->beginTransaction();
        try {
            $this->deleteDistributorOrders($distributorId);
            $stmt = $this->db->prepare('DELETE FROM distributors WHERE id = :id');
            $stmt->execute(['id' => $distributorId]);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success(['message' => 'Distributor deleted successfully.']);
    }

    private function deleteDistributorOrders(int $distributorId): void
    {
        $ordersStmt = $this->db->prepare('SELECT id FROM distributor_orders WHERE distributor_id = :id');
        $ordersStmt->execute(['id' => $distributorId]);
        $orderIds = array_map(
            static fn (array $row): int => (int) $row['id'],
            $ordersStmt->fetchAll()
        );

        if ($orderIds === []) {
            return;
        }

        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
        $deleteOrders = $this->db->prepare("DELETE FROM distributor_orders WHERE id IN ({$placeholders})");
        foreach ($orderIds as $index => $id) {
            $deleteOrders->bindValue($index + 1, $id, PDO::PARAM_INT);
        }
        $deleteOrders->execute();
    }

    private function validate(array $payload): array
    {
        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            throw new ApiException('Validation failed.', 422, ['name' => ['Name is required.']]);
        }

        return [
            'name' => $name,
            'phone' => trim((string) ($payload['phone'] ?? '')),
            'email' => trim((string) ($payload['email'] ?? '')),
            'address' => trim((string) ($payload['address'] ?? '')),
            'status' => trim((string) ($payload['status'] ?? 'active')),
            'notes' => trim((string) ($payload['notes'] ?? '')),
        ];
    }
}
