<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\StateRebuildService;
use App\Support\ApiException;
use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;
use PDO;

class DistributionOrderController
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
        $sql = 'SELECT o.*, d.name AS distributor_name, b.batch_number AS selected_batch_number
                FROM distributor_orders o
                INNER JOIN distributors d ON d.id = o.distributor_id
                LEFT JOIN production_batches b ON b.id = o.selected_batch_id
                WHERE 1 = 1';
        $params = [];
        if ($request->query('distributor_id')) {
            $sql .= ' AND o.distributor_id = :distributor_id';
            $params['distributor_id'] = $request->query('distributor_id');
        }
        if ($request->query('status')) {
            $sql .= ' AND o.status = :status';
            $params['status'] = $request->query('status');
        }
        $sql .= ' ORDER BY o.order_date DESC, o.id DESC';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll();
        foreach ($orders as &$order) {
            $order['batch_sources'] = $this->batchSourcesForOrder((int) $order['id']);
            $order['sizes_summary'] = $this->sizeSummaryForOrder((int) $order['id']);
        }
        unset($order);
        Response::success(['data' => $orders]);
    }

    public function show(Request $request, array $params): never
    {
        $this->auth->requireUser($request);
        $orderId = (int) $params['id'];
        $order = $this->findOrder($orderId);
        $payments = $this->paymentsForOrder($orderId);
        $allocations = $this->allocationRowsForOrder($orderId);
        $lines = $this->linesForOrder($orderId);
        Response::success(['data' => $order, 'lines' => $lines, 'payments' => $payments, 'allocations' => $allocations]);
    }

    public function store(Request $request): never
    {
        $user = $this->auth->requireRole($request, ['admin', 'staff']);
        $payload = $this->validateOrder($request->all());

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO distributor_orders
                 (order_number, distributor_id, selected_batch_id, order_date, bottles_issued, unit_price, payment_type, total_amount, amount_paid, balance_due, cost_of_goods_sold, gross_profit, status, created_by, created_at, updated_at)
                 VALUES
                 (:order_number, :distributor_id, :selected_batch_id, :order_date, :bottles_issued, :unit_price, :payment_type, :total_amount, 0, :balance_due, 0, 0, :status, :created_by, NOW(), NOW())'
            );
            $stmt->execute([
                'order_number' => $payload['order_number'],
                'distributor_id' => $payload['distributor_id'],
                'selected_batch_id' => $payload['selected_batch_id'],
                'order_date' => $payload['order_date'],
                'bottles_issued' => $payload['bottles_issued'],
                'unit_price' => $payload['unit_price'],
                'payment_type' => $payload['payment_type'],
                'total_amount' => $payload['total_amount'],
                'balance_due' => $payload['total_amount'],
                'status' => $payload['status'],
                'created_by' => $user['id'],
            ]);

            $orderId = (int) $this->db->lastInsertId();
            $this->replaceLines($orderId, $payload['lines']);
            $this->insertInitialPayment('distributor_order_payments', 'distributor_order_id', $orderId, $payload['initial_payment'], $payload['order_date'], $payload['payment_method'], $user['id']);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success([
            'message' => 'Distributor order created successfully.',
            'data' => $this->findOrder($orderId),
        ], 201);
    }

    public function update(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $orderId = (int) $params['id'];
        $this->findOrder($orderId);
        $payload = $this->validateOrder($request->all(), false);

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'UPDATE distributor_orders
                 SET order_number = :order_number,
                     distributor_id = :distributor_id,
                     selected_batch_id = :selected_batch_id,
                     order_date = :order_date,
                     bottles_issued = :bottles_issued,
                     unit_price = :unit_price,
                     payment_type = :payment_type,
                     total_amount = :total_amount,
                     balance_due = :total_amount,
                     status = :status,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $orderId,
                'order_number' => $payload['order_number'],
                'distributor_id' => $payload['distributor_id'],
                'selected_batch_id' => $payload['selected_batch_id'],
                'order_date' => $payload['order_date'],
                'bottles_issued' => $payload['bottles_issued'],
                'unit_price' => $payload['unit_price'],
                'payment_type' => $payload['payment_type'],
                'total_amount' => $payload['total_amount'],
                'status' => $payload['status'],
            ]);

            $this->replaceLines($orderId, $payload['lines']);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success(['message' => 'Distributor order updated successfully.', 'data' => $this->findOrder($orderId)]);
    }

    public function destroy(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $orderId = (int) $params['id'];
        $this->findOrder($orderId);

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('DELETE FROM distributor_orders WHERE id = :id');
            $stmt->execute(['id' => $orderId]);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success(['message' => 'Distributor order deleted successfully.']);
    }

    public function addPayment(Request $request, array $params): never
    {
        $user = $this->auth->requireRole($request, ['admin', 'staff']);
        $orderId = (int) $params['id'];
        $this->findOrder($orderId);
        $payload = $this->validatePayment($request->all());

        $stmt = $this->db->prepare(
            'INSERT INTO distributor_order_payments
             (distributor_order_id, payment_date, amount, payment_method, notes, created_by, created_at, updated_at)
             VALUES (:id, :payment_date, :amount, :payment_method, :notes, :created_by, NOW(), NOW())'
        );
        $stmt->execute([
            'id' => $orderId,
            'payment_date' => $payload['payment_date'],
            'amount' => $payload['amount'],
            'payment_method' => $payload['payment_method'],
            'notes' => $payload['notes'],
            'created_by' => $user['id'],
        ]);

        $this->state->rebuildAll();
        Response::success(['message' => 'Distributor payment added successfully.', 'data' => $this->findOrder($orderId)], 201);
    }

    public function analytics(Request $request): never
    {
        $this->auth->requireUser($request);
        $summary = $this->db->query(
            'SELECT COUNT(*) AS total_orders,
                    COALESCE(SUM(total_amount), 0) AS total_sales,
                    COALESCE(SUM(amount_paid), 0) AS total_paid,
                    COALESCE(SUM(balance_due), 0) AS total_outstanding,
                    COALESCE(SUM(gross_profit), 0) AS total_profit
             FROM distributor_orders
             WHERE status = "confirmed"'
        )->fetch();

        $topDistributors = $this->db->query(
            'SELECT d.name,
                    COUNT(o.id) AS orders_count,
                    COALESCE(SUM(o.total_amount), 0) AS total_sales,
                    COALESCE(SUM(o.balance_due), 0) AS outstanding_balance
             FROM distributors d
             LEFT JOIN distributor_orders o ON o.distributor_id = d.id AND o.status = "confirmed"
             GROUP BY d.id, d.name
             ORDER BY total_sales DESC, d.name ASC
             LIMIT 10'
        )->fetchAll();

        Response::success(['summary' => $summary, 'top_distributors' => $topDistributors]);
    }

    private function replaceLines(int $orderId, array $lines): void
    {
        $delete = $this->db->prepare('DELETE FROM distributor_order_lines WHERE distributor_order_id = :id');
        $delete->execute(['id' => $orderId]);

        if ($lines === []) {
            return;
        }

        $insert = $this->db->prepare(
            'INSERT INTO distributor_order_lines
             (distributor_order_id, selected_batch_id, packaging_size_id, size_name, volume_liters, bottles_issued, unit_price, total_amount, created_at, updated_at)
             VALUES
             (:distributor_order_id, :selected_batch_id, :packaging_size_id, :size_name, :volume_liters, :bottles_issued, :unit_price, :total_amount, NOW(), NOW())'
        );

        foreach ($lines as $line) {
            $insert->execute([
                'distributor_order_id' => $orderId,
                'selected_batch_id' => $line['selected_batch_id'],
                'packaging_size_id' => $line['packaging_size_id'],
                'size_name' => $line['size_name'],
                'volume_liters' => $line['volume_liters'],
                'bottles_issued' => $line['bottles_issued'],
                'unit_price' => $line['unit_price'],
                'total_amount' => round($line['bottles_issued'] * $line['unit_price'], 2),
            ]);
        }
    }

    private function findOrder(int $id): array
    {
        $stmt = $this->db->prepare(
            'SELECT o.*, d.name AS distributor_name, b.batch_number AS selected_batch_number
             FROM distributor_orders o
             INNER JOIN distributors d ON d.id = o.distributor_id
             LEFT JOIN production_batches b ON b.id = o.selected_batch_id
             WHERE o.id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new ApiException('Distributor order not found.', 404);
        }

        $row['batch_sources'] = $this->batchSourcesForOrder($id);
        $row['sizes_summary'] = $this->sizeSummaryForOrder($id);

        return $row;
    }

    private function batchSourcesForOrder(int $id): string
    {
        $stmt = $this->db->prepare(
            'SELECT GROUP_CONCAT(DISTINCT b.batch_number ORDER BY b.production_date ASC, b.id ASC SEPARATOR ", ")
             FROM distributor_order_batch_allocations a
             INNER JOIN production_batches b ON b.id = a.source_batch_id
             WHERE a.distributor_order_id = :id'
        );
        $stmt->execute(['id' => $id]);

        return (string) ($stmt->fetchColumn() ?: '');
    }

    private function sizeSummaryForOrder(int $id): string
    {
        $stmt = $this->db->prepare(
            'SELECT GROUP_CONCAT(CONCAT(COALESCE(NULLIF(size_name, ""), "Standard"), " x ", bottles_issued) ORDER BY id ASC SEPARATOR ", ")
             FROM distributor_order_lines
             WHERE distributor_order_id = :id'
        );
        $stmt->execute(['id' => $id]);
        return (string) ($stmt->fetchColumn() ?: '');
    }

    private function allocationRowsForOrder(int $id): array
    {
        $stmt = $this->db->prepare(
            'SELECT a.*, b.batch_number, b.production_date
             FROM distributor_order_batch_allocations a
             INNER JOIN production_batches b ON b.id = a.source_batch_id
             WHERE a.distributor_order_id = :id
             ORDER BY b.production_date ASC, a.id ASC'
        );
        $stmt->execute(['id' => $id]);

        return $stmt->fetchAll();
    }

    private function linesForOrder(int $id): array
    {
        $stmt = $this->db->prepare(
            'SELECT l.*, b.batch_number
             FROM distributor_order_lines l
             INNER JOIN production_batches b ON b.id = l.selected_batch_id
             WHERE l.distributor_order_id = :id
             ORDER BY l.id ASC'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetchAll();
    }

    private function paymentsForOrder(int $id): array
    {
        $stmt = $this->db->prepare('SELECT * FROM distributor_order_payments WHERE distributor_order_id = :id ORDER BY payment_date ASC, id ASC');
        $stmt->execute(['id' => $id]);
        return $stmt->fetchAll();
    }

    private function validateOrder(array $payload, bool $requireInitialPayment = true): array
    {
        $errors = [];
        foreach (['order_number', 'distributor_id', 'order_date'] as $field) {
            if (!isset($payload[$field]) || $payload[$field] === '') {
                $errors[$field][] = ucfirst(str_replace('_', ' ', $field)) . ' is required.';
            }
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        $distributorId = (int) $payload['distributor_id'];
        if ($distributorId <= 0) {
            $errors['distributor_id'][] = 'Select a valid distributor.';
        }

        $lines = [];
        if (isset($payload['lines']) && is_array($payload['lines']) && $payload['lines'] !== []) {
            foreach ($payload['lines'] as $index => $line) {
                $batchId = (int) ($line['selected_batch_id'] ?? 0);
                $packagingSizeId = isset($line['packaging_size_id']) && $line['packaging_size_id'] !== '' ? (int) $line['packaging_size_id'] : null;
                $bottles = (int) ($line['bottles_issued'] ?? 0);
                $unitPrice = (float) ($line['unit_price'] ?? 0);

                if ($batchId <= 0) {
                    $errors["lines.$index.selected_batch_id"][] = 'Batch is required.';
                }
                if ($bottles <= 0) {
                    $errors["lines.$index.bottles_issued"][] = 'Bottles issued must be greater than zero.';
                }
                if ($unitPrice < 0) {
                    $errors["lines.$index.unit_price"][] = 'Unit price cannot be negative.';
                }

                $sizeName = trim((string) ($line['size_name'] ?? ''));
                $volumeLiters = (float) ($line['volume_liters'] ?? 0);
                if ($packagingSizeId !== null) {
                    $sizeStmt = $this->db->prepare('SELECT name, volume_liters FROM packaging_sizes WHERE id = :id LIMIT 1');
                    $sizeStmt->execute(['id' => $packagingSizeId]);
                    $size = $sizeStmt->fetch();
                    if (!$size) {
                        $errors["lines.$index.packaging_size_id"][] = 'Packaging size does not exist.';
                    } else {
                        $sizeName = (string) $size['name'];
                        $volumeLiters = (float) $size['volume_liters'];
                    }
                }
                if ($sizeName === '') {
                    $sizeName = 'Standard Bottle';
                }

                $stockSql = 'SELECT COALESCE(SUM(remaining_bottles), 0)
                             FROM finished_goods_layers
                             WHERE source_batch_id = :batch_id';
                $stockParams = ['batch_id' => $batchId];
                if ($packagingSizeId !== null) {
                    $stockSql .= ' AND packaging_size_id = :size_id';
                    $stockParams['size_id'] = $packagingSizeId;
                } elseif ($sizeName !== '') {
                    $stockSql .= ' AND COALESCE(NULLIF(size_name, ""), "Standard Bottle") = :size_name';
                    $stockParams['size_name'] = $sizeName;
                    if ($volumeLiters > 0) {
                        $stockSql .= ' AND ABS(COALESCE(volume_liters, 0) - :volume_liters) < 0.0001';
                        $stockParams['volume_liters'] = $volumeLiters;
                    }
                }
                $stockStmt = $this->db->prepare($stockSql);
                $stockStmt->execute($stockParams);
                $available = (int) $stockStmt->fetchColumn();
                if ($bottles > $available) {
                    $errors["lines.$index.bottles_issued"][] = 'Requested bottles exceed available stock for selected batch/size.';
                }

                $lines[] = [
                    'selected_batch_id' => $batchId,
                    'packaging_size_id' => $packagingSizeId,
                    'size_name' => $sizeName,
                    'volume_liters' => $volumeLiters,
                    'bottles_issued' => $bottles,
                    'unit_price' => $unitPrice,
                ];
            }
        } else {
            foreach (['selected_batch_id', 'bottles_issued', 'unit_price'] as $field) {
                if (!isset($payload[$field]) || $payload[$field] === '') {
                    $errors[$field][] = ucfirst(str_replace('_', ' ', $field)) . ' is required.';
                }
            }
            $batchId = (int) ($payload['selected_batch_id'] ?? 0);
            $bottles = (int) ($payload['bottles_issued'] ?? 0);
            $unitPrice = (float) ($payload['unit_price'] ?? 0);
            if ($batchId <= 0) {
                $errors['selected_batch_id'][] = 'Select a valid batch.';
            }
            if ($bottles <= 0) {
                $errors['bottles_issued'][] = 'Bottles issued must be greater than zero.';
            }
            if ($unitPrice < 0) {
                $errors['unit_price'][] = 'Unit price cannot be negative.';
            }

            $lines[] = [
                'selected_batch_id' => $batchId,
                'packaging_size_id' => null,
                'size_name' => 'Standard Bottle',
                'volume_liters' => 0,
                'bottles_issued' => $bottles,
                'unit_price' => $unitPrice,
            ];
        }

        if ($errors === []) {
            $distributorExists = $this->db->prepare('SELECT id FROM distributors WHERE id = :id LIMIT 1');
            $distributorExists->execute(['id' => $distributorId]);
            if (!$distributorExists->fetch()) {
                $errors['distributor_id'][] = 'Selected distributor does not exist.';
            }
        }

        $totalBottles = array_sum(array_map(
            static fn (array $line): int => (int) $line['bottles_issued'],
            $lines
        ));
        $total = round(array_sum(array_map(
            static fn (array $line): float => (float) $line['bottles_issued'] * (float) $line['unit_price'],
            $lines
        )), 2);
        $initialPayment = (float) ($payload['initial_payment'] ?? 0);

        if ($initialPayment < 0 || $initialPayment > $total) {
            $errors['initial_payment'][] = 'Initial payment must be between zero and total amount.';
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        $firstLine = $lines[0] ?? [
            'selected_batch_id' => 0,
            'unit_price' => 0,
        ];

        return [
            'order_number' => trim((string) $payload['order_number']),
            'distributor_id' => $distributorId,
            'selected_batch_id' => (int) $firstLine['selected_batch_id'],
            'order_date' => trim((string) $payload['order_date']),
            'bottles_issued' => $totalBottles,
            'unit_price' => (float) $firstLine['unit_price'],
            'payment_type' => trim((string) ($payload['payment_type'] ?? ($initialPayment >= $total ? 'cash' : ($initialPayment > 0 ? 'partial' : 'credit')))),
            'status' => trim((string) ($payload['status'] ?? 'confirmed')),
            'initial_payment' => $initialPayment,
            'payment_method' => trim((string) ($payload['payment_method'] ?? 'cash')),
            'total_amount' => $total,
            'lines' => $lines,
        ];
    }

    private function validatePayment(array $payload): array
    {
        $amount = (float) ($payload['amount'] ?? 0);
        if ($amount <= 0) {
            throw new ApiException('Validation failed.', 422, ['amount' => ['Amount must be greater than zero.']]);
        }

        return [
            'payment_date' => trim((string) ($payload['payment_date'] ?? date('Y-m-d'))),
            'amount' => $amount,
            'payment_method' => trim((string) ($payload['payment_method'] ?? 'cash')),
            'notes' => trim((string) ($payload['notes'] ?? '')),
        ];
    }

    private function insertInitialPayment(string $table, string $fkColumn, int $fkId, float $amount, string $paymentDate, string $method, int $userId): void
    {
        if ($amount <= 0) {
            return;
        }

        $sql = sprintf(
            'INSERT INTO %s (%s, payment_date, amount, payment_method, notes, created_by, created_at, updated_at)
             VALUES (:fk_id, :payment_date, :amount, :payment_method, :notes, :created_by, NOW(), NOW())',
            $table,
            $fkColumn
        );
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'fk_id' => $fkId,
            'payment_date' => $paymentDate,
            'amount' => $amount,
            'payment_method' => $method,
            'notes' => 'Initial payment',
            'created_by' => $userId,
        ]);
    }
}
