<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\ApiException;
use PDO;

class InventoryStockService
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
            $this->db->exec('DELETE FROM inventory_stock_layers');
            $this->db->exec('UPDATE supply_receipt_items
                SET quantity_consumed = 0,
                    remaining_quantity = quantity_received,
                    total_cost = ROUND(quantity_received * unit_cost, 2),
                    updated_at = NOW()');
            $this->db->exec('UPDATE production_batch_items
                SET inventory_quantity_issued = 0,
                    inventory_unit_cost = 0,
                    inventory_consumed_cost = 0,
                    updated_at = NOW()');

            $receiptItems = $this->db->query(
                'SELECT i.*, r.supply_date, r.status
                 FROM supply_receipt_items i
                 INNER JOIN supply_receipts r ON r.id = i.receipt_id
                 WHERE r.status = "received"
                 ORDER BY r.supply_date ASC, r.id ASC, i.id ASC'
            )->fetchAll();

            $insertLayer = $this->db->prepare(
                'INSERT INTO inventory_stock_layers
                 (parameter_id, source_receipt_id, source_receipt_item_id, available_on, original_quantity, remaining_quantity, unit_cost, quantity_unit, status, created_at, updated_at)
                 VALUES
                 (:parameter_id, :source_receipt_id, :source_receipt_item_id, :available_on, :original_quantity, :remaining_quantity, :unit_cost, :quantity_unit, "active", NOW(), NOW())'
            );

            foreach ($receiptItems as $item) {
                $quantity = (float) $item['quantity_received'];
                if ($quantity <= 0) {
                    continue;
                }

                $insertLayer->execute([
                    'parameter_id' => (int) $item['parameter_id'],
                    'source_receipt_id' => (int) $item['receipt_id'],
                    'source_receipt_item_id' => (int) $item['id'],
                    'available_on' => $item['supply_date'],
                    'original_quantity' => $quantity,
                    'remaining_quantity' => $quantity,
                    'unit_cost' => (float) $item['unit_cost'],
                    'quantity_unit' => $item['quantity_unit'],
                ]);
            }

            $productionItems = $this->db->query(
                'SELECT i.id,
                        i.parameter_id,
                        p.name AS parameter_name,
                        p.quantity_unit,
                        i.new_quantity_added,
                        b.batch_number,
                        b.production_date
                 FROM production_batch_items i
                 INNER JOIN production_parameters p ON p.id = i.parameter_id
                 INNER JOIN production_batches b ON b.id = i.batch_id
                 WHERE b.status <> "cancelled"
                 ORDER BY b.production_date ASC, b.id ASC, i.id ASC'
            )->fetchAll();

            foreach ($productionItems as $item) {
                $requiredQuantity = (float) $item['new_quantity_added'];
                if ($requiredQuantity <= 0) {
                    continue;
                }

                $remainingRequired = $requiredQuantity;
                $consumedCost = 0.0;

                $layersStmt = $this->db->prepare(
                    'SELECT *
                     FROM inventory_stock_layers
                     WHERE parameter_id = :parameter_id AND remaining_quantity > 0
                     ORDER BY available_on ASC, id ASC'
                );
                $layersStmt->execute(['parameter_id' => (int) $item['parameter_id']]);
                $layers = $layersStmt->fetchAll();
                $availableTotal = array_reduce(
                    $layers,
                    static fn (float $carry, array $layer): float => $carry + (float) $layer['remaining_quantity'],
                    0.0
                );

                foreach ($layers as $layer) {
                    if ($remainingRequired <= 0) {
                        break;
                    }

                    $available = (float) $layer['remaining_quantity'];
                    $take = min($available, $remainingRequired);
                    $remaining = $available - $take;
                    $remainingRequired -= $take;
                    $consumedCost += $take * (float) $layer['unit_cost'];

                    $updateLayer = $this->db->prepare(
                        'UPDATE inventory_stock_layers
                         SET remaining_quantity = :remaining_quantity,
                             status = :status,
                             updated_at = NOW()
                         WHERE id = :id'
                    );
                    $updateLayer->execute([
                        'remaining_quantity' => $remaining,
                        'status' => $remaining > 0 ? 'active' : 'consumed',
                        'id' => (int) $layer['id'],
                    ]);
                }

                if ($remainingRequired > 0) {
                    throw new ApiException(
                        sprintf(
                            'Insufficient store stock for "%s" in batch %s. Required: %.2f %s, available: %.2f %s.',
                            (string) $item['parameter_name'],
                            (string) $item['batch_number'],
                            $requiredQuantity,
                            (string) $item['quantity_unit'],
                            $availableTotal,
                            (string) $item['quantity_unit']
                        ),
                        422
                    );
                }

                $weightedUnitCost = $requiredQuantity > 0 ? $consumedCost / $requiredQuantity : 0;
                $updateItem = $this->db->prepare(
                    'UPDATE production_batch_items
                     SET inventory_quantity_issued = :inventory_quantity_issued,
                         inventory_unit_cost = :inventory_unit_cost,
                         inventory_consumed_cost = :inventory_consumed_cost,
                         updated_at = NOW()
                     WHERE id = :id'
                );
                $updateItem->execute([
                    'inventory_quantity_issued' => $requiredQuantity,
                    'inventory_unit_cost' => $weightedUnitCost,
                    'inventory_consumed_cost' => $consumedCost,
                    'id' => (int) $item['id'],
                ]);
            }

            $remainingRows = $this->db->query(
                'SELECT source_receipt_item_id,
                        COALESCE(SUM(remaining_quantity), 0) AS remaining_quantity
                 FROM inventory_stock_layers
                 GROUP BY source_receipt_item_id'
            )->fetchAll();

            $remainingByItem = [];
            foreach ($remainingRows as $row) {
                $remainingByItem[(int) $row['source_receipt_item_id']] = (float) $row['remaining_quantity'];
            }

            $items = $this->db->query('SELECT id, quantity_received, unit_cost FROM supply_receipt_items')->fetchAll();
            $updateReceiptItem = $this->db->prepare(
                'UPDATE supply_receipt_items
                 SET remaining_quantity = :remaining_quantity,
                     quantity_consumed = :quantity_consumed,
                     total_cost = :total_cost,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            foreach ($items as $item) {
                $received = (float) $item['quantity_received'];
                $remaining = $remainingByItem[(int) $item['id']] ?? 0.0;
                $updateReceiptItem->execute([
                    'remaining_quantity' => $remaining,
                    'quantity_consumed' => $received - $remaining,
                    'total_cost' => round($received * (float) $item['unit_cost'], 2),
                    'id' => (int) $item['id'],
                ]);
            }

            $this->db->exec(
                'UPDATE supply_receipts r
                 SET total_cost = (
                   SELECT COALESCE(SUM(i.total_cost), 0)
                   FROM supply_receipt_items i
                   WHERE i.receipt_id = r.id
                 ),
                 updated_at = NOW()'
            );

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
}
