<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\StateRebuildService;
use App\Support\ApiException;
use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;
use PDO;

class SupplyReceiptController
{
    public function __construct(
        private readonly PDO $db,
        private readonly Auth $auth,
        private readonly StateRebuildService $state
    ) {
    }

    public function index(Request $request): never
    {
        $this->auth->requireRole($request, ['admin']);

        $sql = 'SELECT * FROM supply_receipts WHERE 1 = 1';
        $params = [];
        if ($request->query('date_from')) {
            $sql .= ' AND supply_date >= :date_from';
            $params['date_from'] = $request->query('date_from');
        }
        if ($request->query('date_to')) {
            $sql .= ' AND supply_date <= :date_to';
            $params['date_to'] = $request->query('date_to');
        }
        if ($request->query('status')) {
            $sql .= ' AND status = :status';
            $params['status'] = $request->query('status');
        }
        $sql .= ' ORDER BY supply_date DESC, id DESC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::success(['data' => $stmt->fetchAll()]);
    }

    public function show(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $receipt = $this->findReceipt((int) $params['id']);

        $itemsStmt = $this->db->prepare(
            'SELECT i.*, p.name AS parameter_name, p.code AS parameter_code
             FROM supply_receipt_items i
             INNER JOIN production_parameters p ON p.id = i.parameter_id
             WHERE i.receipt_id = :receipt_id
             ORDER BY i.id ASC'
        );
        $itemsStmt->execute(['receipt_id' => (int) $params['id']]);

        Response::success([
            'data' => $receipt,
            'items' => $itemsStmt->fetchAll(),
        ]);
    }

    public function stockBalances(Request $request): never
    {
        $this->auth->requireRole($request, ['admin']);

        $stmt = $this->db->query(
            'SELECT p.id AS parameter_id,
                    p.name AS parameter_name,
                    p.code AS parameter_code,
                    p.default_quantity,
                    p.quantity_unit,
                    COALESCE(s.total_quantity_supplied, 0) AS total_quantity_supplied,
                    COALESCE(s.total_quantity_consumed, 0) AS total_quantity_consumed,
                    COALESCE(l.quantity_in_stock, 0) AS quantity_in_stock,
                    COALESCE(l.stock_value, 0) AS stock_value
             FROM production_parameters p
             LEFT JOIN (
               SELECT parameter_id,
                      SUM(quantity_received) AS total_quantity_supplied,
                      SUM(quantity_consumed) AS total_quantity_consumed
               FROM supply_receipt_items
               GROUP BY parameter_id
             ) s ON s.parameter_id = p.id
             LEFT JOIN (
               SELECT parameter_id,
                      SUM(remaining_quantity) AS quantity_in_stock,
                      SUM(remaining_quantity * unit_cost) AS stock_value
               FROM inventory_stock_layers
               WHERE remaining_quantity > 0
               GROUP BY parameter_id
             ) l ON l.parameter_id = p.id
             WHERE p.parameter_kind <> "output"
             ORDER BY p.name ASC'
        );

        Response::success(['data' => $stmt->fetchAll()]);
    }

    public function store(Request $request): never
    {
        $user = $this->auth->requireRole($request, ['admin']);
        $payload = $this->validate($request->all());

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO supply_receipts
                (receipt_number, supply_date, supplier_name, status, total_cost, notes, created_by, created_at, updated_at)
                VALUES
                (:receipt_number, :supply_date, :supplier_name, :status, :total_cost, :notes, :created_by, NOW(), NOW())'
            );
            $stmt->execute([
                'receipt_number' => $payload['receipt_number'],
                'supply_date' => $payload['supply_date'],
                'supplier_name' => $payload['supplier_name'],
                'status' => $payload['status'],
                'total_cost' => $payload['total_cost'],
                'notes' => $payload['notes'],
                'created_by' => $user['id'],
            ]);

            $receiptId = (int) $this->db->lastInsertId();
            $this->replaceItems($receiptId, $payload['items']);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success([
            'message' => 'Supply receipt created successfully.',
            'data' => $this->findReceipt($receiptId),
        ], 201);
    }

    public function update(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $receiptId = (int) $params['id'];
        $this->findReceipt($receiptId);
        $payload = $this->validate($request->all());

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'UPDATE supply_receipts
                 SET receipt_number = :receipt_number,
                     supply_date = :supply_date,
                     supplier_name = :supplier_name,
                     status = :status,
                     total_cost = :total_cost,
                     notes = :notes,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $receiptId,
                'receipt_number' => $payload['receipt_number'],
                'supply_date' => $payload['supply_date'],
                'supplier_name' => $payload['supplier_name'],
                'status' => $payload['status'],
                'total_cost' => $payload['total_cost'],
                'notes' => $payload['notes'],
            ]);

            $delete = $this->db->prepare('DELETE FROM supply_receipt_items WHERE receipt_id = :receipt_id');
            $delete->execute(['receipt_id' => $receiptId]);
            $this->replaceItems($receiptId, $payload['items']);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success([
            'message' => 'Supply receipt updated successfully.',
            'data' => $this->findReceipt($receiptId),
        ]);
    }

    public function destroy(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $receiptId = (int) $params['id'];
        $this->findReceipt($receiptId);

        $this->db->beginTransaction();
        try {
            $delete = $this->db->prepare('DELETE FROM supply_receipts WHERE id = :id');
            $delete->execute(['id' => $receiptId]);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success(['message' => 'Supply receipt deleted successfully.']);
    }

    private function replaceItems(int $receiptId, array $items): void
    {
        $insert = $this->db->prepare(
            'INSERT INTO supply_receipt_items
            (receipt_id, parameter_id, quantity_unit, quantity_received, quantity_consumed, remaining_quantity, unit_cost, total_cost, notes, created_at, updated_at)
            VALUES
            (:receipt_id, :parameter_id, :quantity_unit, :quantity_received, 0, :remaining_quantity, :unit_cost, :total_cost, :notes, NOW(), NOW())'
        );

        foreach ($items as $item) {
            $parameterStmt = $this->db->prepare('SELECT quantity_unit FROM production_parameters WHERE id = :id LIMIT 1');
            $parameterStmt->execute(['id' => (int) $item['parameter_id']]);
            $parameter = $parameterStmt->fetch();
            if (!$parameter) {
                throw new ApiException('One or more supply parameters do not exist.', 422);
            }

            $insert->execute([
                'receipt_id' => $receiptId,
                'parameter_id' => (int) $item['parameter_id'],
                'quantity_unit' => $parameter['quantity_unit'],
                'quantity_received' => (float) $item['quantity_received'],
                'remaining_quantity' => (float) $item['quantity_received'],
                'unit_cost' => (float) $item['unit_cost'],
                'total_cost' => round((float) $item['quantity_received'] * (float) $item['unit_cost'], 2),
                'notes' => trim((string) ($item['notes'] ?? '')),
            ]);
        }
    }

    private function validate(array $payload): array
    {
        $errors = [];
        foreach (['receipt_number', 'supply_date'] as $field) {
            if (!array_key_exists($field, $payload) || trim((string) $payload[$field]) === '') {
                $errors[$field][] = ucfirst(str_replace('_', ' ', $field)) . ' is required.';
            }
        }
        if (empty($payload['items']) || !is_array($payload['items'])) {
            $errors['items'][] = 'At least one supply item is required.';
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        $items = [];
        $totalCost = 0.0;
        foreach ($payload['items'] as $index => $item) {
            if (!isset($item['parameter_id'])) {
                $errors["items.$index.parameter_id"][] = 'Parameter is required.';
                continue;
            }
            $quantity = (float) ($item['quantity_received'] ?? 0);
            $unitCost = (float) ($item['unit_cost'] ?? 0);
            if ($quantity <= 0) {
                $errors["items.$index.quantity_received"][] = 'Quantity received must be greater than zero.';
            }
            if ($unitCost < 0) {
                $errors["items.$index.unit_cost"][] = 'Unit cost cannot be negative.';
            }

            $items[] = [
                'parameter_id' => (int) $item['parameter_id'],
                'quantity_received' => $quantity,
                'unit_cost' => $unitCost,
                'notes' => trim((string) ($item['notes'] ?? '')),
            ];
            $totalCost += $quantity * $unitCost;
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        return [
            'receipt_number' => trim((string) $payload['receipt_number']),
            'supply_date' => trim((string) $payload['supply_date']),
            'supplier_name' => trim((string) ($payload['supplier_name'] ?? '')),
            'status' => trim((string) ($payload['status'] ?? 'received')),
            'notes' => trim((string) ($payload['notes'] ?? '')),
            'total_cost' => round($totalCost, 2),
            'items' => $items,
        ];
    }

    private function findReceipt(int $id): array
    {
        $stmt = $this->db->prepare('SELECT * FROM supply_receipts WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $receipt = $stmt->fetch();
        if (!$receipt) {
            throw new ApiException('Supply receipt not found.', 404);
        }

        return $receipt;
    }
}
