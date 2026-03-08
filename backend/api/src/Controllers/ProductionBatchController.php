<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\StateRebuildService;
use App\Support\ApiException;
use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;
use PDO;

class ProductionBatchController
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

        $sql = 'SELECT * FROM production_batches WHERE 1 = 1';
        $params = [];

        if ($request->query('date_from')) {
            $sql .= ' AND production_date >= :date_from';
            $params['date_from'] = $request->query('date_from');
        }
        if ($request->query('date_to')) {
            $sql .= ' AND production_date <= :date_to';
            $params['date_to'] = $request->query('date_to');
        }
        if ($request->query('status')) {
            $sql .= ' AND status = :status';
            $params['status'] = $request->query('status');
        }

        $sql .= ' ORDER BY production_date DESC, id DESC';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::success(['data' => $stmt->fetchAll()]);
    }

    public function show(Request $request, array $params): never
    {
        $this->auth->requireUser($request);

        $batchId = (int) $params['id'];
        $batch = $this->findBatch($batchId);
        $itemsStmt = $this->db->prepare(
            'SELECT i.*, p.name AS parameter_name, p.code AS parameter_code
             FROM production_batch_items i
             INNER JOIN production_parameters p ON p.id = i.parameter_id
             WHERE i.batch_id = :batch_id
             ORDER BY i.id ASC'
        );
        $itemsStmt->execute(['batch_id' => $batchId]);

        $packagingStmt = $this->db->prepare(
            'SELECT a.*,
                    s.name AS packaging_size_name,
                    s.code AS packaging_size_code
             FROM production_batch_packaging_allocations a
             LEFT JOIN packaging_sizes s ON s.id = a.packaging_size_id
             WHERE a.batch_id = :batch_id
             ORDER BY a.volume_liters ASC, a.id ASC'
        );
        $packagingStmt->execute(['batch_id' => $batchId]);

        $stockStmt = $this->db->prepare(
            'SELECT
                COALESCE(NULLIF(size_name, ""), "Standard Bottle") AS size_name,
                COALESCE(volume_liters, 0) AS volume_liters,
                COALESCE(SUM(original_bottles), 0) AS total_bottles_produced,
                COALESCE(SUM(remaining_bottles), 0) AS bottles_remaining
             FROM finished_goods_layers
             WHERE source_batch_id = :batch_id
             GROUP BY COALESCE(NULLIF(size_name, ""), "Standard Bottle"), COALESCE(volume_liters, 0)
             ORDER BY COALESCE(volume_liters, 0) ASC, size_name ASC'
        );
        $stockStmt->execute(['batch_id' => $batchId]);
        $stockBySize = $stockStmt->fetchAll();
        $expensesStmt = $this->db->prepare(
            'SELECT id, expense_label, amount
             FROM production_batch_expenses
             WHERE batch_id = :batch_id
             ORDER BY id ASC'
        );
        $expensesStmt->execute(['batch_id' => $batchId]);

        $distributionFromLinesStmt = $this->db->prepare(
            'SELECT
                COALESCE(SUM(l.bottles_issued), 0) AS bottles,
                COALESCE(SUM(l.total_amount), 0) AS revenue,
                COALESCE(SUM(l.total_cost), 0) AS cost
             FROM distributor_order_lines l
             INNER JOIN distributor_orders o ON o.id = l.distributor_order_id
             WHERE l.selected_batch_id = :batch_id
               AND o.status = "confirmed"'
        );
        $distributionFromLinesStmt->execute(['batch_id' => $batchId]);
        $distributionFromLines = $distributionFromLinesStmt->fetch() ?: [];

        $distributionLegacyRevenueStmt = $this->db->prepare(
            'SELECT
                COALESCE(SUM(o.bottles_issued), 0) AS bottles,
                COALESCE(SUM(o.total_amount), 0) AS revenue
             FROM distributor_orders o
             WHERE o.selected_batch_id = :batch_id
               AND o.status = "confirmed"
               AND NOT EXISTS (
                    SELECT 1
                    FROM distributor_order_lines l
                    WHERE l.distributor_order_id = o.id
               )'
        );
        $distributionLegacyRevenueStmt->execute(['batch_id' => $batchId]);
        $distributionLegacyRevenue = $distributionLegacyRevenueStmt->fetch() ?: [];

        $distributionLegacyCostStmt = $this->db->prepare(
            'SELECT COALESCE(SUM(a.total_cost), 0) AS cost
             FROM distributor_order_batch_allocations a
             INNER JOIN distributor_orders o ON o.id = a.distributor_order_id
             WHERE a.source_batch_id = :batch_id
               AND o.status = "confirmed"
               AND NOT EXISTS (
                    SELECT 1
                    FROM distributor_order_lines l
                    WHERE l.distributor_order_id = o.id
               )'
        );
        $distributionLegacyCostStmt->execute(['batch_id' => $batchId]);
        $distributionLegacyCost = $distributionLegacyCostStmt->fetch() ?: [];

        $retailFromLinesStmt = $this->db->prepare(
            'SELECT
                COALESCE(SUM(l.bottles_sold), 0) AS bottles,
                COALESCE(SUM(l.total_amount), 0) AS revenue,
                COALESCE(SUM(l.total_cost), 0) AS cost
             FROM retail_sale_lines l
             INNER JOIN retail_sales s ON s.id = l.retail_sale_id
             WHERE l.selected_batch_id = :batch_id
               AND s.status = "confirmed"'
        );
        $retailFromLinesStmt->execute(['batch_id' => $batchId]);
        $retailFromLines = $retailFromLinesStmt->fetch() ?: [];

        $retailLegacyRevenueStmt = $this->db->prepare(
            'SELECT
                COALESCE(SUM(s.bottles_sold), 0) AS bottles,
                COALESCE(SUM(s.total_amount), 0) AS revenue
             FROM retail_sales s
             WHERE s.selected_batch_id = :batch_id
               AND s.status = "confirmed"
               AND NOT EXISTS (
                    SELECT 1
                    FROM retail_sale_lines l
                    WHERE l.retail_sale_id = s.id
               )'
        );
        $retailLegacyRevenueStmt->execute(['batch_id' => $batchId]);
        $retailLegacyRevenue = $retailLegacyRevenueStmt->fetch() ?: [];

        $retailLegacyCostStmt = $this->db->prepare(
            'SELECT COALESCE(SUM(a.total_cost), 0) AS cost
             FROM retail_sale_batch_allocations a
             INNER JOIN retail_sales s ON s.id = a.retail_sale_id
             WHERE a.source_batch_id = :batch_id
               AND s.status = "confirmed"
               AND NOT EXISTS (
                    SELECT 1
                    FROM retail_sale_lines l
                    WHERE l.retail_sale_id = s.id
               )'
        );
        $retailLegacyCostStmt->execute(['batch_id' => $batchId]);
        $retailLegacyCost = $retailLegacyCostStmt->fetch() ?: [];

        $soldBottles =
            (int) ($distributionFromLines['bottles'] ?? 0) +
            (int) ($distributionLegacyRevenue['bottles'] ?? 0) +
            (int) ($retailFromLines['bottles'] ?? 0) +
            (int) ($retailLegacyRevenue['bottles'] ?? 0);

        $soldRevenue =
            (float) ($distributionFromLines['revenue'] ?? 0) +
            (float) ($distributionLegacyRevenue['revenue'] ?? 0) +
            (float) ($retailFromLines['revenue'] ?? 0) +
            (float) ($retailLegacyRevenue['revenue'] ?? 0);

        $soldCost =
            (float) ($distributionFromLines['cost'] ?? 0) +
            (float) ($distributionLegacyCost['cost'] ?? 0) +
            (float) ($retailFromLines['cost'] ?? 0) +
            (float) ($retailLegacyCost['cost'] ?? 0);

        $packagingAllocations = $packagingStmt->fetchAll();
        $derivedSoldCost = $this->derivedSoldCostFromBatch(
            $batch,
            $stockBySize
        );

        if ($derivedSoldCost > 0) {
            $soldCost = $derivedSoldCost;
        }

        $soldProfit = round($soldRevenue - $soldCost, 2);

        Response::success([
            'data' => $batch,
            'items' => $itemsStmt->fetchAll(),
            'packaging_allocations' => $packagingAllocations,
            'stock_by_size' => $stockBySize,
            'expenses' => $expensesStmt->fetchAll(),
            'sales_summary' => [
                'sold_bottles' => $soldBottles,
                'revenue' => round($soldRevenue, 2),
                'cost' => round($soldCost, 2),
                'profit' => $soldProfit,
            ],
        ]);
    }

    private function derivedSoldCostFromBatch(array $batch, array $stockBySize): float
    {
        $batchLiters = (float) ($batch['batch_size_liters'] ?? 0);
        $batchTotalCost = (float) ($batch['total_cost'] ?? 0);
        $batchBottlesProduced = (int) ($batch['bottles_produced'] ?? 0);
        if ($batchTotalCost <= 0) {
            return 0.0;
        }

        $soldBottles = 0;
        $soldLiters = 0.0;
        foreach ($stockBySize as $row) {
            $produced = (int) ($row['total_bottles_produced'] ?? 0);
            $remaining = (int) ($row['bottles_remaining'] ?? 0);
            $moved = max($produced - $remaining, 0);
            if ($moved <= 0) {
                continue;
            }
            $soldBottles += $moved;
            $soldLiters += $moved * (float) ($row['volume_liters'] ?? 0);
        }

        if ($soldBottles <= 0) {
            return 0.0;
        }

        if ($batchLiters > 0 && $soldLiters > 0) {
            $effectiveLiters = min($soldLiters, $batchLiters);
            $costPerLiter = $batchTotalCost / $batchLiters;
            return round($effectiveLiters * $costPerLiter, 2);
        }

        if ($batchBottlesProduced > 0) {
            $ratio = min($soldBottles, $batchBottlesProduced) / $batchBottlesProduced;
            return round($batchTotalCost * $ratio, 2);
        }

        return 0.0;
    }

    public function leftovers(Request $request): never
    {
        $this->auth->requireUser($request);
        $stmt = $this->db->query(
            'SELECT l.*, p.name AS parameter_name, p.code AS parameter_code
             FROM production_leftover_layers l
             INNER JOIN production_parameters p ON p.id = l.parameter_id
             WHERE l.remaining_quantity > 0
             ORDER BY p.name ASC, l.created_at ASC'
        );
        Response::success(['data' => $stmt->fetchAll()]);
    }

    public function store(Request $request): never
    {
        $user = $this->auth->requireRole($request, ['admin', 'staff']);
        $payload = $this->validate($request->all());

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO production_batches
                (batch_number, production_date, batch_size_liters, bottles_produced, selling_price_per_bottle, notes, status, created_by, created_at, updated_at)
                VALUES
                (:batch_number, :production_date, :batch_size_liters, :bottles_produced, :selling_price_per_bottle, :notes, :status, :created_by, NOW(), NOW())'
            );
            $stmt->execute([
                'batch_number' => $payload['batch_number'],
                'production_date' => $payload['production_date'],
                'batch_size_liters' => $payload['batch_size_liters'],
                'bottles_produced' => $payload['bottles_produced'],
                'selling_price_per_bottle' => 0,
                'notes' => $payload['notes'],
                'status' => $payload['status'],
                'created_by' => $user['id'],
            ]);

            $batchId = (int) $this->db->lastInsertId();
            $this->replaceItems($batchId, $payload['items'], $payload['packaging_allocations']);
            $this->replacePackagingAllocations($batchId, $payload);
            $this->replaceExpenses($batchId, $payload['expenses']);

            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success([
            'message' => 'Production batch created successfully.',
            'data' => $this->findBatch($batchId),
        ], 201);
    }

    public function update(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $batchId = (int) $params['id'];
        $this->findBatch($batchId);
        $payload = $this->validate($request->all());

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'UPDATE production_batches
                 SET batch_number = :batch_number,
                     production_date = :production_date,
                     batch_size_liters = :batch_size_liters,
                     bottles_produced = :bottles_produced,
                     selling_price_per_bottle = :selling_price_per_bottle,
                     notes = :notes,
                     status = :status,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $batchId,
                'batch_number' => $payload['batch_number'],
                'production_date' => $payload['production_date'],
                'batch_size_liters' => $payload['batch_size_liters'],
                'bottles_produced' => $payload['bottles_produced'],
                'selling_price_per_bottle' => 0,
                'notes' => $payload['notes'],
                'status' => $payload['status'],
            ]);

            $deleteItems = $this->db->prepare('DELETE FROM production_batch_items WHERE batch_id = :batch_id');
            $deleteItems->execute(['batch_id' => $batchId]);
            $this->replaceItems($batchId, $payload['items'], $payload['packaging_allocations']);
            $deletePackaging = $this->db->prepare('DELETE FROM production_batch_packaging_allocations WHERE batch_id = :batch_id');
            $deletePackaging->execute(['batch_id' => $batchId]);
            $this->replacePackagingAllocations($batchId, $payload);
            $deleteExpenses = $this->db->prepare('DELETE FROM production_batch_expenses WHERE batch_id = :batch_id');
            $deleteExpenses->execute(['batch_id' => $batchId]);
            $this->replaceExpenses($batchId, $payload['expenses']);

            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success([
            'message' => 'Production batch updated successfully.',
            'data' => $this->findBatch($batchId),
        ]);
    }

    private function replacePackagingAllocations(int $batchId, array $payload): void
    {
        $litersProduced = (float) $payload['batch_size_liters'];
        $totalBatchCost = $this->batchTotalCost($batchId);
        $liquidCostPerLiter = $litersProduced > 0 ? ($totalBatchCost / $litersProduced) : 0;

        $allocations = $payload['packaging_allocations'];
        if ($allocations === []) {
            $bottles = (int) $payload['bottles_produced'];
            if ($bottles > 0) {
                $volumeLiters = $litersProduced > 0 ? ($litersProduced / $bottles) : 0;
                $unitLiquidCost = $volumeLiters * $liquidCostPerLiter;
                $unitTotalCost = $bottles > 0 ? ($totalBatchCost / $bottles) : 0;
                $allocations[] = [
                    'packaging_size_id' => null,
                    'size_name' => 'Standard Bottle',
                    'volume_liters' => $volumeLiters,
                    'bottles_allocated' => $bottles,
                    'selling_price_per_bottle' => 0.0,
                    'unit_packaging_cost' => round(max($unitTotalCost - $unitLiquidCost, 0), 4),
                ];
            }
        }

        if ($allocations === []) {
            return;
        }

        $insert = $this->db->prepare(
            'INSERT INTO production_batch_packaging_allocations
            (batch_id, packaging_size_id, size_name, volume_liters, bottles_allocated, liters_allocated, unit_packaging_cost, unit_liquid_cost, unit_total_cost, selling_price_per_bottle, created_at, updated_at)
            VALUES
            (:batch_id, :packaging_size_id, :size_name, :volume_liters, :bottles_allocated, :liters_allocated, :unit_packaging_cost, :unit_liquid_cost, :unit_total_cost, :selling_price_per_bottle, NOW(), NOW())'
        );

        foreach ($allocations as $allocation) {
            $bottles = (int) $allocation['bottles_allocated'];
            if ($bottles <= 0) {
                continue;
            }

            $volumeLiters = (float) $allocation['volume_liters'];
            $litersAllocated = round($volumeLiters * $bottles, 3);
            $unitLiquidCost = round($volumeLiters * $liquidCostPerLiter, 4);
            $unitPackagingCost = round((float) ($allocation['unit_packaging_cost'] ?? 0), 4);
            $unitTotalCost = round($unitLiquidCost + $unitPackagingCost, 4);

            $insert->execute([
                'batch_id' => $batchId,
                'packaging_size_id' => $allocation['packaging_size_id'],
                'size_name' => $allocation['size_name'],
                'volume_liters' => $volumeLiters,
                'bottles_allocated' => $bottles,
                'liters_allocated' => $litersAllocated,
                'unit_packaging_cost' => $unitPackagingCost,
                'unit_liquid_cost' => $unitLiquidCost,
                'unit_total_cost' => $unitTotalCost,
                'selling_price_per_bottle' => (float) $allocation['selling_price_per_bottle'],
            ]);
        }
    }

    private function batchTotalCost(int $batchId): float
    {
        $stmt = $this->db->prepare(
            'SELECT COALESCE(SUM(consumed_cost), 0)
             FROM production_batch_items
             WHERE batch_id = :batch_id'
        );
        $stmt->execute(['batch_id' => $batchId]);
        return round((float) $stmt->fetchColumn(), 2);
    }

    private function replaceExpenses(int $batchId, array $expenses): void
    {
        if ($expenses === []) {
            return;
        }

        $insert = $this->db->prepare(
            'INSERT INTO production_batch_expenses
             (batch_id, expense_label, amount, created_at, updated_at)
             VALUES (:batch_id, :expense_label, :amount, NOW(), NOW())'
        );

        foreach ($expenses as $expense) {
            $label = trim((string) ($expense['expense_label'] ?? ''));
            $amount = (float) ($expense['amount'] ?? 0);
            if ($label === '' || $amount <= 0) {
                continue;
            }

            $insert->execute([
                'batch_id' => $batchId,
                'expense_label' => $label,
                'amount' => $amount,
            ]);
        }
    }

    public function destroy(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $batchId = (int) $params['id'];
        $this->findBatch($batchId);

        $this->db->beginTransaction();
        try {
            $this->deleteDependentTransactions($batchId);
            $deleteItems = $this->db->prepare('DELETE FROM production_batch_items WHERE batch_id = :batch_id');
            $deleteItems->execute(['batch_id' => $batchId]);
            $deleteBatch = $this->db->prepare('DELETE FROM production_batches WHERE id = :id');
            $deleteBatch->execute(['id' => $batchId]);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success(['message' => 'Production batch deleted successfully.']);
    }

    private function deleteDependentTransactions(int $batchId): void
    {
        $distributionIdsStmt = $this->db->prepare(
            'SELECT DISTINCT o.id
             FROM distributor_orders o
             LEFT JOIN distributor_order_lines l ON l.distributor_order_id = o.id
             WHERE o.selected_batch_id = :batch_id_order OR l.selected_batch_id = :batch_id_line'
        );
        $distributionIdsStmt->execute([
            'batch_id_order' => $batchId,
            'batch_id_line' => $batchId,
        ]);
        $distributionIds = array_map(
            static fn (array $row): int => (int) $row['id'],
            $distributionIdsStmt->fetchAll()
        );

        if ($distributionIds !== []) {
            $this->deleteByIds('distributor_orders', $distributionIds);
        }

        $salesIdsStmt = $this->db->prepare(
            'SELECT DISTINCT s.id
             FROM retail_sales s
             LEFT JOIN retail_sale_lines l ON l.retail_sale_id = s.id
             WHERE s.selected_batch_id = :batch_id_sale OR l.selected_batch_id = :batch_id_line'
        );
        $salesIdsStmt->execute([
            'batch_id_sale' => $batchId,
            'batch_id_line' => $batchId,
        ]);
        $salesIds = array_map(
            static fn (array $row): int => (int) $row['id'],
            $salesIdsStmt->fetchAll()
        );

        if ($salesIds !== []) {
            $this->deleteByIds('retail_sales', $salesIds);
        }
    }

    private function deleteByIds(string $table, array $ids): void
    {
        if ($ids === []) {
            return;
        }

        $normalized = array_values(array_map(
            static fn (int|string $id): int => (int) $id,
            $ids
        ));
        $placeholders = implode(',', array_fill(0, count($normalized), '?'));
        $stmt = $this->db->prepare("DELETE FROM {$table} WHERE id IN ({$placeholders})");
        foreach ($normalized as $index => $id) {
            $stmt->bindValue($index + 1, $id, PDO::PARAM_INT);
        }
        $stmt->execute();
    }

    private function replaceItems(int $batchId, array $items, array $packagingAllocations): void
    {
        $aggregated = [];
        foreach ($items as $item) {
            $parameterId = (int) $item['parameter_id'];
            if (!isset($aggregated[$parameterId])) {
                $aggregated[$parameterId] = [
                    'parameter_id' => $parameterId,
                    'new_quantity_added' => 0.0,
                    'closing_leftover_quantity' => 0.0,
                    'notes' => '',
                ];
            }
            $aggregated[$parameterId]['new_quantity_added'] += (float) $item['new_quantity_added'];
            $aggregated[$parameterId]['closing_leftover_quantity'] += (float) $item['closing_leftover_quantity'];
        }

        foreach ($packagingAllocations as $allocation) {
            $sourceParameterId = (int) ($allocation['source_parameter_id'] ?? 0);
            if ($sourceParameterId <= 0) {
                continue;
            }
            if (!isset($aggregated[$sourceParameterId])) {
                $aggregated[$sourceParameterId] = [
                    'parameter_id' => $sourceParameterId,
                    'new_quantity_added' => 0.0,
                    'closing_leftover_quantity' => 0.0,
                    'notes' => '',
                ];
            }
            $aggregated[$sourceParameterId]['new_quantity_added'] += (float) ($allocation['bottles_allocated'] ?? 0);
        }

        $stmt = $this->db->prepare(
            'INSERT INTO production_batch_items
            (batch_id, parameter_id, quantity_unit, new_quantity_added, closing_leftover_quantity, notes, created_at, updated_at)
            VALUES
            (:batch_id, :parameter_id, :quantity_unit, :new_quantity_added, :closing_leftover_quantity, :notes, NOW(), NOW())'
        );

        foreach ($aggregated as $item) {
            $parameterStmt = $this->db->prepare('SELECT quantity_unit FROM production_parameters WHERE id = :id LIMIT 1');
            $parameterStmt->execute(['id' => (int) $item['parameter_id']]);
            $parameter = $parameterStmt->fetch();

            if (!$parameter) {
                throw new ApiException('One or more production parameters do not exist.', 422);
            }

            $stmt->execute([
                'batch_id' => $batchId,
                'parameter_id' => (int) $item['parameter_id'],
                'quantity_unit' => $parameter['quantity_unit'],
                'new_quantity_added' => (float) $item['new_quantity_added'],
                'closing_leftover_quantity' => (float) $item['closing_leftover_quantity'],
                'notes' => trim((string) ($item['notes'] ?? '')),
            ]);
        }
    }

    private function validate(array $payload): array
    {
        $errors = [];
        foreach (['batch_number', 'production_date', 'batch_size_liters'] as $field) {
            if (!array_key_exists($field, $payload) || $payload[$field] === '') {
                $errors[$field][] = ucfirst(str_replace('_', ' ', $field)) . ' is required.';
            }
        }
        if (empty($payload['items']) || !is_array($payload['items'])) {
            $errors['items'][] = 'At least one production item is required.';
        }
        if (isset($payload['batch_size_liters']) && (float) $payload['batch_size_liters'] <= 0) {
            $errors['batch_size_liters'][] = 'Batch size liters must be greater than zero.';
        }

        $items = [];
        foreach ($payload['items'] as $index => $item) {
            if (!isset($item['parameter_id'])) {
                $errors["items.$index.parameter_id"][] = 'Parameter is required.';
                continue;
            }
            $items[] = [
                'parameter_id' => (int) $item['parameter_id'],
                'new_quantity_added' => (float) ($item['new_quantity_added'] ?? 0),
                'closing_leftover_quantity' => (float) ($item['closing_leftover_quantity'] ?? 0),
                'notes' => trim((string) ($item['notes'] ?? '')),
            ];
            if ((float) ($item['new_quantity_added'] ?? 0) < 0) {
                $errors["items.$index.new_quantity_added"][] = 'Quantity taken from store cannot be negative.';
            }
            if ((float) ($item['closing_leftover_quantity'] ?? 0) < 0) {
                $errors["items.$index.closing_leftover_quantity"][] = 'Closing leftover cannot be negative.';
            }
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        $packagingAllocations = [];
        if (isset($payload['packaging_allocations']) && is_array($payload['packaging_allocations'])) {
            foreach ($payload['packaging_allocations'] as $index => $allocation) {
                $packagingSizeId = isset($allocation['packaging_size_id']) && $allocation['packaging_size_id'] !== ''
                    ? (int) $allocation['packaging_size_id']
                    : null;
                $sourceParameterId = isset($allocation['source_parameter_id']) && $allocation['source_parameter_id'] !== ''
                    ? (int) $allocation['source_parameter_id']
                    : null;
                $bottlesAllocated = (int) ($allocation['bottles_allocated'] ?? 0);
                $litersAllocated = (float) ($allocation['liters_allocated'] ?? 0);
                $volumeLiters = (float) ($allocation['volume_liters'] ?? 0);

                if ($bottlesAllocated <= 0) {
                    continue;
                }

                if ($litersAllocated > 0 && $bottlesAllocated > 0) {
                    $volumeLiters = $litersAllocated / $bottlesAllocated;
                }

                $sizeName = trim((string) ($allocation['size_name'] ?? ''));
                if ($packagingSizeId !== null) {
                    $sizeStmt = $this->db->prepare('SELECT id, name, volume_liters, bottle_cost, cap_cost, label_cost, extra_packaging_cost, default_selling_price FROM packaging_sizes WHERE id = :id LIMIT 1');
                    $sizeStmt->execute(['id' => $packagingSizeId]);
                    $size = $sizeStmt->fetch();
                    if (!$size) {
                        $errors["packaging_allocations.$index.packaging_size_id"][] = 'Packaging size does not exist.';
                        continue;
                    }

                    $sizeName = (string) $size['name'];
                    $volumeLiters = (float) $size['volume_liters'];
                    $defaultPackagingCost = (float) $size['bottle_cost']
                        + (float) $size['cap_cost']
                        + (float) $size['label_cost']
                        + (float) $size['extra_packaging_cost'];
                    $defaultSellingPrice = (float) $size['default_selling_price'];
                } else {
                    $defaultPackagingCost = 0.0;
                    $defaultSellingPrice = 0.0;
                    if ($sizeName === '') {
                        $sizeName = 'Custom Size';
                    }
                }
                if ($sourceParameterId !== null && $sourceParameterId > 0) {
                    $paramStmt = $this->db->prepare(
                        'SELECT id, name, quantity_unit, default_quantity
                         FROM production_parameters
                         WHERE id = :id
                         LIMIT 1'
                    );
                    $paramStmt->execute(['id' => $sourceParameterId]);
                    $sourceParameter = $paramStmt->fetch();
                    if ($sourceParameter) {
                        $sizeName = (string) $sourceParameter['name'];
                        $unit = strtolower((string) $sourceParameter['quantity_unit']);
                        $defaultQty = (float) $sourceParameter['default_quantity'];
                        if ($unit === 'ml') {
                            $volumeLiters = $defaultQty / 1000;
                        } elseif (in_array($unit, ['liter', 'litre', 'l'], true)) {
                            $volumeLiters = $defaultQty;
                        } elseif ($volumeLiters <= 0) {
                            $volumeLiters = $defaultQty;
                        }
                    }
                }

                if ($volumeLiters <= 0) {
                    $errors["packaging_allocations.$index.volume_liters"][] = 'Volume liters must be greater than zero.';
                    continue;
                }

                $litersAllocated = round($volumeLiters * $bottlesAllocated, 3);

                $packagingAllocations[] = [
                    'source_parameter_id' => $sourceParameterId,
                    'packaging_size_id' => $packagingSizeId,
                    'size_name' => $sizeName,
                    'volume_liters' => $volumeLiters,
                    'bottles_allocated' => $bottlesAllocated,
                    'liters_allocated' => $litersAllocated,
                    'unit_packaging_cost' => isset($allocation['unit_packaging_cost']) && $allocation['unit_packaging_cost'] !== ''
                        ? (float) $allocation['unit_packaging_cost']
                        : $defaultPackagingCost,
                    'selling_price_per_bottle' => isset($allocation['selling_price_per_bottle']) && $allocation['selling_price_per_bottle'] !== ''
                        ? (float) $allocation['selling_price_per_bottle']
                        : $defaultSellingPrice,
                ];
            }
        }

        if ($packagingAllocations !== []) {
            $totalBottlesBySizes = array_sum(array_map(
                static fn (array $row): int => (int) $row['bottles_allocated'],
                $packagingAllocations
            ));
            if ($totalBottlesBySizes <= 0) {
                $errors['packaging_allocations'][] = 'At least one packaging row with bottles is required.';
            }
        } else {
            $totalBottlesBySizes = (int) ($payload['bottles_produced'] ?? 0);
        }

        if ($totalBottlesBySizes <= 0) {
            $errors['bottles_produced'][] = 'Bottles produced must be greater than zero.';
        }

        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        $expenses = [];
        if (isset($payload['expenses']) && is_array($payload['expenses'])) {
            foreach ($payload['expenses'] as $index => $expense) {
                $label = trim((string) ($expense['expense_label'] ?? ''));
                $amount = (float) ($expense['amount'] ?? 0);
                if ($label === '' && $amount <= 0) {
                    continue;
                }
                if ($label === '') {
                    $errors["expenses.$index.expense_label"][] = 'Expense label is required.';
                    continue;
                }
                if ($amount < 0) {
                    $errors["expenses.$index.amount"][] = 'Expense amount cannot be negative.';
                    continue;
                }
                if ($amount === 0) {
                    continue;
                }
                $expenses[] = [
                    'expense_label' => $label,
                    'amount' => round($amount, 2),
                ];
            }
        }

        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        return [
            'batch_number' => trim((string) $payload['batch_number']),
            'production_date' => trim((string) $payload['production_date']),
            'batch_size_liters' => (float) $payload['batch_size_liters'],
            'bottles_produced' => $totalBottlesBySizes,
            'selling_price_per_bottle' => 0.0,
            'notes' => trim((string) ($payload['notes'] ?? '')),
            'status' => trim((string) ($payload['status'] ?? 'completed')),
            'items' => $items,
            'packaging_allocations' => $packagingAllocations,
            'expenses' => $expenses,
        ];
    }

    private function findBatch(int $id): array
    {
        $stmt = $this->db->prepare('SELECT * FROM production_batches WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $batch = $stmt->fetch();
        if (!$batch) {
            throw new ApiException('Production batch not found.', 404);
        }

        return $batch;
    }
}
