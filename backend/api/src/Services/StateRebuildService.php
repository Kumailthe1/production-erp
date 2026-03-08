<?php

declare(strict_types=1);

namespace App\Services;

class StateRebuildService
{
    public function __construct(
        private readonly InventoryStockService $inventory,
        private readonly ProductionCostingService $production,
        private readonly FinishedGoodsService $finishedGoods
    ) {
    }

    public function rebuildAll(): void
    {
        $this->inventory->rebuildAll();
        $this->production->rebuildAll();
        $this->finishedGoods->rebuildAll();
    }
}
