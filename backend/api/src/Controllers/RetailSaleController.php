<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\StateRebuildService;
use App\Support\ApiException;
use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;
use PDO;

class RetailSaleController
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
        $sql = 'SELECT s.*, b.batch_number AS selected_batch_number
                FROM retail_sales s
                LEFT JOIN production_batches b ON b.id = s.selected_batch_id
                WHERE 1 = 1';
        $params = [];
        if ($request->query('status')) {
            $sql .= ' AND s.status = :status';
            $params['status'] = $request->query('status');
        }
        $sql .= ' ORDER BY s.sale_date DESC, s.id DESC';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $sales = $stmt->fetchAll();
        foreach ($sales as &$sale) {
            $sale['batch_sources'] = $this->batchSourcesForSale((int) $sale['id']);
            $sale['sizes_summary'] = $this->sizeSummaryForSale((int) $sale['id']);
        }
        unset($sale);
        Response::success(['data' => $sales]);
    }

    public function show(Request $request, array $params): never
    {
        $this->auth->requireUser($request);
        $saleId = (int) $params['id'];
        $sale = $this->findSale($saleId);
        $payments = $this->paymentsForSale($saleId);
        $allocations = $this->allocationRowsForSale($saleId);
        $lines = $this->linesForSale($saleId);
        Response::success(['data' => $sale, 'lines' => $lines, 'payments' => $payments, 'allocations' => $allocations]);
    }

    public function store(Request $request): never
    {
        $user = $this->auth->requireRole($request, ['admin', 'staff']);
        $payload = $this->validateSale($request->all());

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO retail_sales
                 (sale_number, selected_batch_id, sale_date, customer_name, customer_phone, bottles_sold, unit_price, payment_type, total_amount, amount_paid, balance_due, cost_of_goods_sold, gross_profit, status, created_by, created_at, updated_at)
                 VALUES
                 (:sale_number, :selected_batch_id, :sale_date, :customer_name, :customer_phone, :bottles_sold, :unit_price, :payment_type, :total_amount, 0, :balance_due, 0, 0, :status, :created_by, NOW(), NOW())'
            );
            $stmt->execute([
                'sale_number' => $payload['sale_number'],
                'selected_batch_id' => $payload['selected_batch_id'],
                'sale_date' => $payload['sale_date'],
                'customer_name' => $this->nullableText($payload['customer_name']),
                'customer_phone' => $payload['customer_phone'],
                'bottles_sold' => $payload['bottles_sold'],
                'unit_price' => $payload['unit_price'],
                'payment_type' => $payload['payment_type'],
                'total_amount' => $payload['total_amount'],
                'balance_due' => $payload['total_amount'],
                'status' => $payload['status'],
                'created_by' => $user['id'],
            ]);

            $saleId = (int) $this->db->lastInsertId();
            $this->replaceLines($saleId, $payload['lines']);
            $this->insertInitialPayment($saleId, $payload['initial_payment'], $payload['sale_date'], $payload['payment_method'], $user['id']);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success(['message' => 'Retail sale created successfully.', 'data' => $this->findSale($saleId)], 201);
    }

    public function update(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $saleId = (int) $params['id'];
        $this->findSale($saleId);
        $payload = $this->validateSale($request->all());

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'UPDATE retail_sales
                 SET sale_number = :sale_number,
                     selected_batch_id = :selected_batch_id,
                     sale_date = :sale_date,
                     customer_name = :customer_name,
                     customer_phone = :customer_phone,
                     bottles_sold = :bottles_sold,
                     unit_price = :unit_price,
                     payment_type = :payment_type,
                     total_amount = :total_amount,
                     balance_due = :total_amount,
                     status = :status,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $saleId,
                'sale_number' => $payload['sale_number'],
                'selected_batch_id' => $payload['selected_batch_id'],
                'sale_date' => $payload['sale_date'],
                'customer_name' => $this->nullableText($payload['customer_name']),
                'customer_phone' => $payload['customer_phone'],
                'bottles_sold' => $payload['bottles_sold'],
                'unit_price' => $payload['unit_price'],
                'payment_type' => $payload['payment_type'],
                'total_amount' => $payload['total_amount'],
                'status' => $payload['status'],
            ]);

            $this->replaceLines($saleId, $payload['lines']);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success(['message' => 'Retail sale updated successfully.', 'data' => $this->findSale($saleId)]);
    }

    public function destroy(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $saleId = (int) $params['id'];
        $this->findSale($saleId);

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('DELETE FROM retail_sales WHERE id = :id');
            $stmt->execute(['id' => $saleId]);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success(['message' => 'Retail sale deleted successfully.']);
    }

    public function addPayment(Request $request, array $params): never
    {
        $user = $this->auth->requireRole($request, ['admin', 'staff']);
        $saleId = (int) $params['id'];
        $this->findSale($saleId);
        $payload = $this->validatePayment($request->all());

        $stmt = $this->db->prepare(
            'INSERT INTO retail_sale_payments
             (retail_sale_id, payment_date, amount, payment_method, notes, created_by, created_at, updated_at)
             VALUES (:id, :payment_date, :amount, :payment_method, :notes, :created_by, NOW(), NOW())'
        );
        $stmt->execute([
            'id' => $saleId,
            'payment_date' => $payload['payment_date'],
            'amount' => $payload['amount'],
            'payment_method' => $payload['payment_method'],
            'notes' => $payload['notes'],
            'created_by' => $user['id'],
        ]);

        $this->state->rebuildAll();
        Response::success(['message' => 'Retail payment added successfully.', 'data' => $this->findSale($saleId)], 201);
    }

    public function analytics(Request $request): never
    {
        $this->auth->requireUser($request);
        $summary = $this->db->query(
            'SELECT COUNT(*) AS total_sales_count,
                    COALESCE(SUM(total_amount), 0) AS total_sales,
                    COALESCE(SUM(amount_paid), 0) AS total_paid,
                    COALESCE(SUM(balance_due), 0) AS total_outstanding,
                    COALESCE(SUM(gross_profit), 0) AS total_profit
             FROM retail_sales
             WHERE status = "confirmed"'
        )->fetch();

        Response::success(['summary' => $summary]);
    }

    public function stock(Request $request): never
    {
        $this->auth->requireUser($request);
        $summary = $this->db->query(
            'SELECT COALESCE(SUM(remaining_bottles), 0) AS bottles_available,
                    COALESCE(SUM(remaining_bottles * cost_per_bottle), 0) AS stock_value
             FROM finished_goods_layers
             WHERE remaining_bottles > 0'
        )->fetch();

        $layers = $this->db->query(
            'SELECT f.*, b.batch_number, b.production_date
             FROM finished_goods_layers f
             INNER JOIN production_batches b ON b.id = f.source_batch_id
             WHERE f.remaining_bottles > 0
             ORDER BY b.production_date ASC, f.id ASC'
        )->fetchAll();

        Response::success(['summary' => $summary, 'layers' => $layers]);
    }

    private function replaceLines(int $saleId, array $lines): void
    {
        $delete = $this->db->prepare('DELETE FROM retail_sale_lines WHERE retail_sale_id = :id');
        $delete->execute(['id' => $saleId]);

        if ($lines === []) {
            return;
        }

        $insert = $this->db->prepare(
            'INSERT INTO retail_sale_lines
             (retail_sale_id, selected_batch_id, packaging_size_id, size_name, volume_liters, bottles_sold, unit_price, total_amount, created_at, updated_at)
             VALUES
             (:retail_sale_id, :selected_batch_id, :packaging_size_id, :size_name, :volume_liters, :bottles_sold, :unit_price, :total_amount, NOW(), NOW())'
        );

        foreach ($lines as $line) {
            $insert->execute([
                'retail_sale_id' => $saleId,
                'selected_batch_id' => $line['selected_batch_id'],
                'packaging_size_id' => $line['packaging_size_id'],
                'size_name' => $line['size_name'],
                'volume_liters' => $line['volume_liters'],
                'bottles_sold' => $line['bottles_sold'],
                'unit_price' => $line['unit_price'],
                'total_amount' => round($line['bottles_sold'] * $line['unit_price'], 2),
            ]);
        }
    }

    private function findSale(int $id): array
    {
        $stmt = $this->db->prepare(
            'SELECT s.*, b.batch_number AS selected_batch_number
             FROM retail_sales s
             LEFT JOIN production_batches b ON b.id = s.selected_batch_id
             WHERE s.id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new ApiException('Retail sale not found.', 404);
        }
        $row['batch_sources'] = $this->batchSourcesForSale($id);
        $row['sizes_summary'] = $this->sizeSummaryForSale($id);
        return $row;
    }

    private function batchSourcesForSale(int $id): string
    {
        $stmt = $this->db->prepare(
            'SELECT GROUP_CONCAT(DISTINCT b.batch_number ORDER BY b.production_date ASC, b.id ASC SEPARATOR ", ")
             FROM retail_sale_batch_allocations a
             INNER JOIN production_batches b ON b.id = a.source_batch_id
             WHERE a.retail_sale_id = :id'
        );
        $stmt->execute(['id' => $id]);

        return (string) ($stmt->fetchColumn() ?: '');
    }

    private function sizeSummaryForSale(int $id): string
    {
        $stmt = $this->db->prepare(
            'SELECT GROUP_CONCAT(CONCAT(COALESCE(NULLIF(size_name, ""), "Standard"), " x ", bottles_sold) ORDER BY id ASC SEPARATOR ", ")
             FROM retail_sale_lines
             WHERE retail_sale_id = :id'
        );
        $stmt->execute(['id' => $id]);
        return (string) ($stmt->fetchColumn() ?: '');
    }

    private function allocationRowsForSale(int $id): array
    {
        $stmt = $this->db->prepare(
            'SELECT a.*, b.batch_number, b.production_date
             FROM retail_sale_batch_allocations a
             INNER JOIN production_batches b ON b.id = a.source_batch_id
             WHERE a.retail_sale_id = :id
             ORDER BY b.production_date ASC, a.id ASC'
        );
        $stmt->execute(['id' => $id]);

        return $stmt->fetchAll();
    }

    private function linesForSale(int $id): array
    {
        $stmt = $this->db->prepare(
            'SELECT l.*, b.batch_number
             FROM retail_sale_lines l
             INNER JOIN production_batches b ON b.id = l.selected_batch_id
             WHERE l.retail_sale_id = :id
             ORDER BY l.id ASC'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetchAll();
    }

    private function paymentsForSale(int $id): array
    {
        $stmt = $this->db->prepare('SELECT * FROM retail_sale_payments WHERE retail_sale_id = :id ORDER BY payment_date ASC, id ASC');
        $stmt->execute(['id' => $id]);
        return $stmt->fetchAll();
    }

    private function validateSale(array $payload): array
    {
        $errors = [];
        foreach (['sale_number', 'sale_date'] as $field) {
            if (!isset($payload[$field]) || $payload[$field] === '') {
                $errors[$field][] = ucfirst(str_replace('_', ' ', $field)) . ' is required.';
            }
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        $lines = [];
        if (isset($payload['lines']) && is_array($payload['lines']) && $payload['lines'] !== []) {
            foreach ($payload['lines'] as $index => $line) {
                $batchId = (int) ($line['selected_batch_id'] ?? 0);
                $packagingSizeId = isset($line['packaging_size_id']) && $line['packaging_size_id'] !== '' ? (int) $line['packaging_size_id'] : null;
                $bottles = (int) ($line['bottles_sold'] ?? 0);
                $unitPrice = (float) ($line['unit_price'] ?? 0);

                if ($batchId <= 0) {
                    $errors["lines.$index.selected_batch_id"][] = 'Batch is required.';
                }
                if ($bottles <= 0) {
                    $errors["lines.$index.bottles_sold"][] = 'Bottles sold must be greater than zero.';
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
                    $errors["lines.$index.bottles_sold"][] = 'Requested bottles exceed available stock for selected batch/size.';
                }

                $lines[] = [
                    'selected_batch_id' => $batchId,
                    'packaging_size_id' => $packagingSizeId,
                    'size_name' => $sizeName,
                    'volume_liters' => $volumeLiters,
                    'bottles_sold' => $bottles,
                    'unit_price' => $unitPrice,
                ];
            }
        } else {
            foreach (['selected_batch_id', 'bottles_sold', 'unit_price'] as $field) {
                if (!isset($payload[$field]) || $payload[$field] === '') {
                    $errors[$field][] = ucfirst(str_replace('_', ' ', $field)) . ' is required.';
                }
            }
            $batchId = (int) ($payload['selected_batch_id'] ?? 0);
            $bottles = (int) ($payload['bottles_sold'] ?? 0);
            $unitPrice = (float) ($payload['unit_price'] ?? 0);
            if ($batchId <= 0) {
                $errors['selected_batch_id'][] = 'Select a valid batch.';
            }
            if ($bottles <= 0) {
                $errors['bottles_sold'][] = 'Bottles sold must be greater than zero.';
            }
            if ($unitPrice < 0) {
                $errors['unit_price'][] = 'Unit price cannot be negative.';
            }

            $lines[] = [
                'selected_batch_id' => $batchId,
                'packaging_size_id' => null,
                'size_name' => 'Standard Bottle',
                'volume_liters' => 0,
                'bottles_sold' => $bottles,
                'unit_price' => $unitPrice,
            ];
        }

        $totalBottles = array_sum(array_map(
            static fn (array $line): int => (int) $line['bottles_sold'],
            $lines
        ));
        $total = round(array_sum(array_map(
            static fn (array $line): float => (float) $line['bottles_sold'] * (float) $line['unit_price'],
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
            'sale_number' => trim((string) $payload['sale_number']),
            'selected_batch_id' => (int) $firstLine['selected_batch_id'],
            'sale_date' => trim((string) $payload['sale_date']),
            'customer_name' => trim((string) ($payload['customer_name'] ?? '')),
            'customer_phone' => trim((string) ($payload['customer_phone'] ?? '')),
            'bottles_sold' => $totalBottles,
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

    private function insertInitialPayment(int $saleId, float $amount, string $paymentDate, string $method, int $userId): void
    {
        if ($amount <= 0) {
            return;
        }

        $stmt = $this->db->prepare(
            'INSERT INTO retail_sale_payments
             (retail_sale_id, payment_date, amount, payment_method, notes, created_by, created_at, updated_at)
             VALUES (:sale_id, :payment_date, :amount, :payment_method, :notes, :created_by, NOW(), NOW())'
        );
        $stmt->execute([
            'sale_id' => $saleId,
            'payment_date' => $paymentDate,
            'amount' => $amount,
            'payment_method' => $method,
            'notes' => 'Initial payment',
            'created_by' => $userId,
        ]);
    }

    private function nullableText(string $value): ?string
    {
        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }
}
