<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\ApiException;
use PDO;

class ProductionCostingService
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
            $this->db->exec('DELETE FROM production_leftover_layers');
            $this->db->exec('UPDATE production_batch_items
                SET opening_leftover_quantity = 0,
                    total_available_quantity = 0,
                    quantity_consumed = 0,
                    fresh_quantity_consumed = 0,
                    leftover_quantity_consumed = 0,
                    consumed_cost = 0,
                    unit_cost_snapshot = 0,
                    updated_at = NOW()');

            $batchesStmt = $this->db->query('SELECT id FROM production_batches ORDER BY production_date ASC, id ASC');
            $batchIds = $batchesStmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($batchIds as $batchId) {
                $this->rebuildBatch((int) $batchId);
            }

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

    private function rebuildBatch(int $batchId): void
    {
        $itemsStmt = $this->db->prepare(
            'SELECT i.*, p.unit_cost AS parameter_unit_cost, p.quantity_unit AS parameter_quantity_unit
             FROM production_batch_items i
             INNER JOIN production_parameters p ON p.id = i.parameter_id
             WHERE i.batch_id = :batch_id
             ORDER BY i.id ASC'
        );
        $itemsStmt->execute(['batch_id' => $batchId]);
        $items = $itemsStmt->fetchAll();

        $batchTotalCost = 0.0;

        foreach ($items as $item) {
            $parameterId = (int) $item['parameter_id'];
            $freshQuantity = (float) $item['new_quantity_added'];
            $closingLeftover = (float) $item['closing_leftover_quantity'];
            $inventoryConsumedCost = (float) ($item['inventory_consumed_cost'] ?? 0);
            $currentUnitCost = $freshQuantity > 0
                ? ((float) ($item['inventory_unit_cost'] ?? 0) ?: ($inventoryConsumedCost / $freshQuantity))
                : (float) $item['parameter_unit_cost'];

            $layersStmt = $this->db->prepare(
                'SELECT * FROM production_leftover_layers
                 WHERE parameter_id = :parameter_id AND remaining_quantity > 0
                 ORDER BY created_at ASC, id ASC'
            );
            $layersStmt->execute(['parameter_id' => $parameterId]);
            $layers = $layersStmt->fetchAll();

            $openingLeftover = 0.0;
            foreach ($layers as $layer) {
                $openingLeftover += (float) $layer['remaining_quantity'];
            }

            $totalAvailable = $openingLeftover + $freshQuantity;
            if ($closingLeftover > $totalAvailable) {
                throw new ApiException(
                    sprintf(
                        'Closing leftover for parameter %d cannot exceed total available quantity.',
                        $parameterId
                    ),
                    422
                );
            }

            $quantityConsumed = $totalAvailable - $closingLeftover;
            $remainingToConsume = $quantityConsumed;
            $leftoverConsumedQty = 0.0;
            $freshConsumedQty = 0.0;
            $consumedCost = 0.0;

            foreach ($layers as $layer) {
                if ($remainingToConsume <= 0) {
                    break;
                }

                $available = (float) $layer['remaining_quantity'];
                $take = min($available, $remainingToConsume);
                $remaining = $available - $take;
                $leftoverConsumedQty += $take;
                $consumedCost += $take * (float) $layer['unit_cost'];
                $remainingToConsume -= $take;

                $updateLayer = $this->db->prepare(
                    'UPDATE production_leftover_layers
                     SET remaining_quantity = :remaining_quantity,
                         status = :status,
                         updated_at = NOW()
                     WHERE id = :id'
                );
                $updateLayer->execute([
                    'remaining_quantity' => $remaining,
                    'status' => $remaining > 0 ? 'active' : 'consumed',
                    'id' => $layer['id'],
                ]);
            }

            if ($remainingToConsume > 0) {
                $freshConsumedQty = $remainingToConsume;
                $consumedCost += $freshConsumedQty * $currentUnitCost;
            }

            $freshRemaining = max($freshQuantity - $freshConsumedQty, 0);
            if ($freshRemaining > 0) {
                $insertLayer = $this->db->prepare(
                    'INSERT INTO production_leftover_layers
                     (parameter_id, source_batch_id, source_batch_item_id, original_quantity, remaining_quantity, unit_cost, quantity_unit, status, created_at, updated_at)
                     VALUES (:parameter_id, :source_batch_id, :source_batch_item_id, :original_quantity, :remaining_quantity, :unit_cost, :quantity_unit, "active", NOW(), NOW())'
                );
                $insertLayer->execute([
                    'parameter_id' => $parameterId,
                    'source_batch_id' => $batchId,
                    'source_batch_item_id' => $item['id'],
                    'original_quantity' => $freshRemaining,
                    'remaining_quantity' => $freshRemaining,
                    'unit_cost' => $currentUnitCost,
                    'quantity_unit' => $item['quantity_unit'] ?: $item['parameter_quantity_unit'],
                ]);
            }

            $updateItem = $this->db->prepare(
                'UPDATE production_batch_items
                 SET opening_leftover_quantity = :opening_leftover_quantity,
                     total_available_quantity = :total_available_quantity,
                     quantity_consumed = :quantity_consumed,
                     fresh_quantity_consumed = :fresh_quantity_consumed,
                     leftover_quantity_consumed = :leftover_quantity_consumed,
                     consumed_cost = :consumed_cost,
                     unit_cost_snapshot = :unit_cost_snapshot,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $updateItem->execute([
                'opening_leftover_quantity' => $openingLeftover,
                'total_available_quantity' => $totalAvailable,
                'quantity_consumed' => $quantityConsumed,
                'fresh_quantity_consumed' => $freshConsumedQty,
                'leftover_quantity_consumed' => $leftoverConsumedQty,
                'consumed_cost' => $consumedCost,
                'unit_cost_snapshot' => $currentUnitCost,
                'id' => $item['id'],
            ]);

            $batchTotalCost += $consumedCost;
        }

        $batchStmt = $this->db->prepare('SELECT bottles_produced, selling_price_per_bottle FROM production_batches WHERE id = :id LIMIT 1');
        $batchStmt->execute(['id' => $batchId]);
        $batch = $batchStmt->fetch() ?: ['bottles_produced' => 0, 'selling_price_per_bottle' => 0];

        $expensesStmt = $this->db->prepare(
            'SELECT COALESCE(SUM(amount), 0) FROM production_batch_expenses WHERE batch_id = :batch_id'
        );
        $expensesStmt->execute(['batch_id' => $batchId]);
        $batchTotalCost += (float) $expensesStmt->fetchColumn();

        $bottlesProduced = (float) $batch['bottles_produced'];
        $sellingPrice = (float) $batch['selling_price_per_bottle'];
        $costPerBottle = $bottlesProduced > 0 ? $batchTotalCost / $bottlesProduced : 0.0;
        $projectedRevenue = $bottlesProduced * $sellingPrice;
        $projectedProfit = $projectedRevenue - $batchTotalCost;

        $updateBatch = $this->db->prepare(
            'UPDATE production_batches
             SET total_cost = :total_cost,
                 cost_per_bottle = :cost_per_bottle,
                 projected_revenue = :projected_revenue,
                 projected_profit = :projected_profit,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $updateBatch->execute([
            'total_cost' => $batchTotalCost,
            'cost_per_bottle' => $costPerBottle,
            'projected_revenue' => $projectedRevenue,
            'projected_profit' => $projectedProfit,
            'id' => $batchId,
        ]);
    }
}
