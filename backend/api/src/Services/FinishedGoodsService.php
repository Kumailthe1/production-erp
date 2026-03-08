<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\ApiException;
use PDO;

class FinishedGoodsService
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function rebuildAll(): void
    {
        $managesTransaction = !$this->db->inTransaction();
        if ($managesTransaction) {
            $this->db->beginTransaction();
        }

        try {
            $this->db->exec('DELETE FROM finished_goods_layers');
            $this->db->exec('DELETE FROM distributor_order_batch_allocations');
            $this->db->exec('DELETE FROM retail_sale_batch_allocations');
            $this->db->exec('UPDATE distributor_orders
                SET total_amount = 0,
                    amount_paid = 0,
                    balance_due = 0,
                    cost_of_goods_sold = 0,
                    gross_profit = 0,
                    updated_at = NOW()');
            $this->db->exec('UPDATE retail_sales
                SET total_amount = 0,
                    amount_paid = 0,
                    balance_due = 0,
                    cost_of_goods_sold = 0,
                    gross_profit = 0,
                    updated_at = NOW()');
            $this->db->exec('UPDATE distributor_order_lines
                SET total_amount = ROUND(bottles_issued * unit_price, 2),
                    cost_per_bottle = 0,
                    total_cost = 0,
                    gross_profit = 0,
                    updated_at = NOW()');
            $this->db->exec('UPDATE retail_sale_lines
                SET total_amount = ROUND(bottles_sold * unit_price, 2),
                    cost_per_bottle = 0,
                    total_cost = 0,
                    gross_profit = 0,
                    updated_at = NOW()');

            $this->seedFinishedGoodsLayers();
            $this->consumeDistributorOrders();
            $this->consumeRetailSales();

            if ($managesTransaction) {
                $this->db->commit();
            }
        } catch (\Throwable $throwable) {
            if ($managesTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $throwable;
        }
    }

    private function seedFinishedGoodsLayers(): void
    {
        $batches = $this->db->query(
            'SELECT id, production_date, batch_size_liters, bottles_produced, cost_per_bottle, selling_price_per_bottle, status
             FROM production_batches
             WHERE status = "completed"
             ORDER BY production_date ASC, id ASC'
        )->fetchAll();

        $allocationStmt = $this->db->prepare(
            'SELECT *
             FROM production_batch_packaging_allocations
             WHERE batch_id = :batch_id
             ORDER BY volume_liters ASC, id ASC'
        );

        $insertLayer = $this->db->prepare(
            'INSERT INTO finished_goods_layers
             (source_batch_id, packaging_size_id, size_name, volume_liters, available_on, original_bottles, remaining_bottles, cost_per_bottle, selling_price_per_bottle, status, created_at, updated_at)
             VALUES (:source_batch_id, :packaging_size_id, :size_name, :volume_liters, :available_on, :original_bottles, :remaining_bottles, :cost_per_bottle, :selling_price_per_bottle, "active", NOW(), NOW())'
        );

        foreach ($batches as $batch) {
            $batchId = (int) $batch['id'];
            $allocationStmt->execute(['batch_id' => $batchId]);
            $allocations = $allocationStmt->fetchAll();

            if ($allocations !== []) {
                foreach ($allocations as $allocation) {
                    $bottles = (int) $allocation['bottles_allocated'];
                    if ($bottles <= 0) {
                        continue;
                    }

                    $insertLayer->execute([
                        'source_batch_id' => $batchId,
                        'packaging_size_id' => $allocation['packaging_size_id'] !== null ? (int) $allocation['packaging_size_id'] : null,
                        'size_name' => (string) $allocation['size_name'],
                        'volume_liters' => (float) $allocation['volume_liters'],
                        'available_on' => $batch['production_date'],
                        'original_bottles' => $bottles,
                        'remaining_bottles' => $bottles,
                        'cost_per_bottle' => (float) $allocation['unit_total_cost'],
                        'selling_price_per_bottle' => (float) $allocation['selling_price_per_bottle'],
                    ]);
                }
                continue;
            }

            $bottles = (int) $batch['bottles_produced'];
            if ($bottles <= 0) {
                continue;
            }

            $volumeLiters = $bottles > 0 ? ((float) $batch['batch_size_liters'] / $bottles) : 0;
            $insertLayer->execute([
                'source_batch_id' => $batchId,
                'packaging_size_id' => null,
                'size_name' => 'Standard Bottle',
                'volume_liters' => $volumeLiters,
                'available_on' => $batch['production_date'],
                'original_bottles' => $bottles,
                'remaining_bottles' => $bottles,
                'cost_per_bottle' => (float) $batch['cost_per_bottle'],
                'selling_price_per_bottle' => (float) $batch['selling_price_per_bottle'],
            ]);
        }
    }

    private function consumeDistributorOrders(): void
    {
        $orders = $this->db->query(
            'SELECT *
             FROM distributor_orders
             WHERE status = "confirmed"
             ORDER BY order_date ASC, id ASC'
        )->fetchAll();

        foreach ($orders as $order) {
            $lines = $this->distributionLines((int) $order['id'], (int) $order['selected_batch_id'], (int) $order['bottles_issued'], (float) $order['unit_price']);
            $summary = $this->consumeLines($lines, 'distribution', (int) $order['id'], (string) $order['order_number']);
            $amountPaid = $this->sumPayments('distributor_order_payments', 'distributor_order_id', (int) $order['id']);
            $balance = max($summary['total_amount'] - $amountPaid, 0);

            $update = $this->db->prepare(
                'UPDATE distributor_orders
                 SET bottles_issued = :bottles_issued,
                     total_amount = :total_amount,
                     amount_paid = :amount_paid,
                     balance_due = :balance_due,
                     cost_of_goods_sold = :cost_of_goods_sold,
                     gross_profit = :gross_profit,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $update->execute([
                'id' => (int) $order['id'],
                'bottles_issued' => $summary['bottles'],
                'total_amount' => $summary['total_amount'],
                'amount_paid' => $amountPaid,
                'balance_due' => $balance,
                'cost_of_goods_sold' => $summary['total_cost'],
                'gross_profit' => $summary['total_profit'],
            ]);
        }
    }

    private function consumeRetailSales(): void
    {
        $sales = $this->db->query(
            'SELECT *
             FROM retail_sales
             WHERE status = "confirmed"
             ORDER BY sale_date ASC, id ASC'
        )->fetchAll();

        foreach ($sales as $sale) {
            $lines = $this->retailLines((int) $sale['id'], (int) $sale['selected_batch_id'], (int) $sale['bottles_sold'], (float) $sale['unit_price']);
            $summary = $this->consumeLines($lines, 'retail', (int) $sale['id'], (string) $sale['sale_number']);
            $amountPaid = $this->sumPayments('retail_sale_payments', 'retail_sale_id', (int) $sale['id']);
            $balance = max($summary['total_amount'] - $amountPaid, 0);

            $update = $this->db->prepare(
                'UPDATE retail_sales
                 SET bottles_sold = :bottles_sold,
                     total_amount = :total_amount,
                     amount_paid = :amount_paid,
                     balance_due = :balance_due,
                     cost_of_goods_sold = :cost_of_goods_sold,
                     gross_profit = :gross_profit,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $update->execute([
                'id' => (int) $sale['id'],
                'bottles_sold' => $summary['bottles'],
                'total_amount' => $summary['total_amount'],
                'amount_paid' => $amountPaid,
                'balance_due' => $balance,
                'cost_of_goods_sold' => $summary['total_cost'],
                'gross_profit' => $summary['total_profit'],
            ]);
        }
    }

    private function distributionLines(int $orderId, int $selectedBatchId, int $legacyBottles, float $legacyUnitPrice): array
    {
        $stmt = $this->db->prepare('SELECT * FROM distributor_order_lines WHERE distributor_order_id = :id ORDER BY id ASC');
        $stmt->execute(['id' => $orderId]);
        $rows = $stmt->fetchAll();
        if ($rows !== []) {
            return $rows;
        }

        if ($selectedBatchId <= 0 || $legacyBottles <= 0) {
            return [];
        }

        return [[
            'id' => 0,
            'selected_batch_id' => $selectedBatchId,
            'packaging_size_id' => null,
            'size_name' => 'Standard Bottle',
            'volume_liters' => 0,
            'bottles_issued' => $legacyBottles,
            'unit_price' => $legacyUnitPrice,
        ]];
    }

    private function retailLines(int $saleId, int $selectedBatchId, int $legacyBottles, float $legacyUnitPrice): array
    {
        $stmt = $this->db->prepare('SELECT * FROM retail_sale_lines WHERE retail_sale_id = :id ORDER BY id ASC');
        $stmt->execute(['id' => $saleId]);
        $rows = $stmt->fetchAll();
        if ($rows !== []) {
            return $rows;
        }

        if ($selectedBatchId <= 0 || $legacyBottles <= 0) {
            return [];
        }

        return [[
            'id' => 0,
            'selected_batch_id' => $selectedBatchId,
            'packaging_size_id' => null,
            'size_name' => 'Standard Bottle',
            'volume_liters' => 0,
            'bottles_sold' => $legacyBottles,
            'unit_price' => $legacyUnitPrice,
        ]];
    }

    private function consumeLines(array $lines, string $transactionType, int $transactionId, string $reference): array
    {
        $totalBottles = 0;
        $totalAmount = 0.0;
        $totalCost = 0.0;

        foreach ($lines as $line) {
            $bottles = (int) ($transactionType === 'distribution' ? ($line['bottles_issued'] ?? 0) : ($line['bottles_sold'] ?? 0));
            $unitPrice = (float) ($line['unit_price'] ?? 0);
            if ($bottles <= 0) {
                continue;
            }

            $lineCost = $this->allocateBottles(
                $bottles,
                $reference,
                $transactionType,
                $transactionId,
                (int) ($line['selected_batch_id'] ?? 0),
                isset($line['packaging_size_id']) && $line['packaging_size_id'] !== null ? (int) $line['packaging_size_id'] : null,
                (string) ($line['size_name'] ?? ''),
                (float) ($line['volume_liters'] ?? 0)
            );

            $lineAmount = round($bottles * $unitPrice, 2);
            $lineProfit = round($lineAmount - $lineCost, 2);
            $costPerBottle = $bottles > 0 ? round($lineCost / $bottles, 4) : 0.0;

            if ((int) ($line['id'] ?? 0) > 0) {
                $table = $transactionType === 'distribution' ? 'distributor_order_lines' : 'retail_sale_lines';
                $key = $transactionType === 'distribution' ? 'bottles_issued' : 'bottles_sold';
                $update = $this->db->prepare(
                    "UPDATE {$table}
                     SET {$key} = :bottles,
                         total_amount = :total_amount,
                         cost_per_bottle = :cost_per_bottle,
                         total_cost = :total_cost,
                         gross_profit = :gross_profit,
                         updated_at = NOW()
                     WHERE id = :id"
                );
                $update->execute([
                    'id' => (int) $line['id'],
                    'bottles' => $bottles,
                    'total_amount' => $lineAmount,
                    'cost_per_bottle' => $costPerBottle,
                    'total_cost' => $lineCost,
                    'gross_profit' => $lineProfit,
                ]);
            }

            $totalBottles += $bottles;
            $totalAmount += $lineAmount;
            $totalCost += $lineCost;
        }

        return [
            'bottles' => $totalBottles,
            'total_amount' => round($totalAmount, 2),
            'total_cost' => round($totalCost, 2),
            'total_profit' => round($totalAmount - $totalCost, 2),
        ];
    }

    private function allocateBottles(
        int $bottles,
        string $reference,
        string $transactionType,
        int $transactionId,
        int $selectedBatchId,
        ?int $packagingSizeId,
        string $sizeName,
        float $volumeLiters
    ): float {
        if ($bottles <= 0) {
            return 0.0;
        }

        $remaining = $bottles;
        $cost = 0.0;

        $sql = 'SELECT *
                FROM finished_goods_layers
                WHERE remaining_bottles > 0
                  AND source_batch_id = :selected_batch_id';
        $params = ['selected_batch_id' => $selectedBatchId];

        if ($packagingSizeId !== null) {
            $sql .= ' AND packaging_size_id = :packaging_size_id';
            $params['packaging_size_id'] = $packagingSizeId;
        } elseif ($sizeName !== '') {
            $sql .= ' AND COALESCE(NULLIF(size_name, ""), "Standard Bottle") = :size_name';
            $params['size_name'] = $sizeName;
            if ($volumeLiters > 0) {
                $sql .= ' AND ABS(COALESCE(volume_liters, 0) - :volume_liters) < 0.0001';
                $params['volume_liters'] = $volumeLiters;
            }
        }

        $sql .= ' ORDER BY available_on ASC, id ASC';
        $layersStmt = $this->db->prepare($sql);
        $layersStmt->execute($params);
        $layers = $layersStmt->fetchAll();

        // Backward-compatible fallback:
        // old orders may keep legacy size names (e.g. "Bottle") while new batches store descriptive names
        // (e.g. "0.5 liter Bottle"). If name+volume returns nothing, retry by volume only.
        if (
            $layers === []
            && $packagingSizeId === null
            && $selectedBatchId > 0
            && $volumeLiters > 0
        ) {
            $fallbackStmt = $this->db->prepare(
                'SELECT *
                 FROM finished_goods_layers
                 WHERE remaining_bottles > 0
                   AND source_batch_id = :selected_batch_id
                   AND ABS(COALESCE(volume_liters, 0) - :volume_liters) < 0.0001
                 ORDER BY available_on ASC, id ASC'
            );
            $fallbackStmt->execute([
                'selected_batch_id' => $selectedBatchId,
                'volume_liters' => $volumeLiters,
            ]);
            $layers = $fallbackStmt->fetchAll();
        }

        foreach ($layers as $layer) {
            if ($remaining <= 0) {
                break;
            }

            $available = (int) $layer['remaining_bottles'];
            $take = min($available, $remaining);
            $remaining -= $take;
            $cost += $take * (float) $layer['cost_per_bottle'];
            $this->recordAllocation($transactionType, $transactionId, $layer, $take);

            $update = $this->db->prepare(
                'UPDATE finished_goods_layers
                 SET remaining_bottles = :remaining_bottles,
                     status = :status,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $left = $available - $take;
            $update->execute([
                'remaining_bottles' => $left,
                'status' => $left > 0 ? 'active' : 'consumed',
                'id' => (int) $layer['id'],
            ]);
        }

        if ($remaining > 0) {
            throw new ApiException(
                sprintf('Insufficient finished bottles in the selected batch/size for transaction %s.', $reference),
                422
            );
        }

        return round($cost, 2);
    }

    private function recordAllocation(string $transactionType, int $transactionId, array $layer, int $bottlesAllocated): void
    {
        $table = $transactionType === 'distribution'
            ? 'distributor_order_batch_allocations'
            : 'retail_sale_batch_allocations';
        $foreignKey = $transactionType === 'distribution'
            ? 'distributor_order_id'
            : 'retail_sale_id';

        $sql = sprintf(
            'INSERT INTO %s (%s, finished_goods_layer_id, source_batch_id, packaging_size_id, size_name, volume_liters, bottles_allocated, cost_per_bottle, total_cost, created_at, updated_at)
             VALUES (:transaction_id, :finished_goods_layer_id, :source_batch_id, :packaging_size_id, :size_name, :volume_liters, :bottles_allocated, :cost_per_bottle, :total_cost, NOW(), NOW())',
            $table,
            $foreignKey
        );

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'transaction_id' => $transactionId,
            'finished_goods_layer_id' => (int) $layer['id'],
            'source_batch_id' => (int) $layer['source_batch_id'],
            'packaging_size_id' => $layer['packaging_size_id'] !== null ? (int) $layer['packaging_size_id'] : null,
            'size_name' => (string) ($layer['size_name'] ?? 'Standard Bottle'),
            'volume_liters' => (float) ($layer['volume_liters'] ?? 0),
            'bottles_allocated' => $bottlesAllocated,
            'cost_per_bottle' => (float) $layer['cost_per_bottle'],
            'total_cost' => round($bottlesAllocated * (float) $layer['cost_per_bottle'], 2),
        ]);
    }

    private function sumPayments(string $table, string $fkColumn, int $id): float
    {
        $stmt = $this->db->prepare(
            sprintf('SELECT COALESCE(SUM(amount), 0) FROM %s WHERE %s = :id', $table, $fkColumn)
        );
        $stmt->execute(['id' => $id]);

        return round((float) $stmt->fetchColumn(), 2);
    }
}
