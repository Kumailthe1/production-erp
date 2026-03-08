<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;
use PDO;

class DashboardController
{
    public function __construct(
        private readonly PDO $db,
        private readonly Auth $auth
    ) {
    }

    public function overview(Request $request): never
    {
        $this->auth->requireRole($request, ['admin']);

        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        $production = $this->singleRow(
            'SELECT COUNT(*) AS batches_count,
                    COALESCE(SUM(bottles_produced), 0) AS bottles_produced,
                    COALESCE(SUM(total_cost), 0) AS production_cost,
                    COALESCE(SUM(projected_revenue), 0) AS projected_revenue,
                    COALESCE(SUM(projected_profit), 0) AS projected_profit
             FROM production_batches
             WHERE status = "completed"
               AND production_date BETWEEN :date_from AND :date_to',
            ['date_from' => $dateFrom, 'date_to' => $dateTo]
        );

        $supply = $this->singleRow(
            'SELECT COUNT(*) AS receipts_count,
                    COALESCE(SUM(total_cost), 0) AS supply_cost
             FROM supply_receipts
             WHERE status = "received"
               AND supply_date BETWEEN :date_from AND :date_to',
            ['date_from' => $dateFrom, 'date_to' => $dateTo]
        );

        $distribution = $this->singleRow(
            'SELECT COUNT(*) AS orders_count,
                    COALESCE(SUM(bottles_issued), 0) AS bottles_issued,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COALESCE(SUM(amount_paid), 0) AS amount_paid,
                    COALESCE(SUM(balance_due), 0) AS balance_due,
                    COALESCE(SUM(gross_profit), 0) AS profit
             FROM distributor_orders
             WHERE status = "confirmed"
               AND order_date BETWEEN :date_from AND :date_to',
            ['date_from' => $dateFrom, 'date_to' => $dateTo]
        );

        $retail = $this->singleRow(
            'SELECT COUNT(*) AS sales_count,
                    COALESCE(SUM(bottles_sold), 0) AS bottles_sold,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COALESCE(SUM(amount_paid), 0) AS amount_paid,
                    COALESCE(SUM(balance_due), 0) AS balance_due,
                    COALESCE(SUM(gross_profit), 0) AS profit
             FROM retail_sales
             WHERE status = "confirmed"
               AND sale_date BETWEEN :date_from AND :date_to',
            ['date_from' => $dateFrom, 'date_to' => $dateTo]
        );

        $rawStock = $this->singleRow(
            'SELECT COALESCE(SUM(remaining_quantity), 0) AS quantity_in_stock,
                    COALESCE(SUM(remaining_quantity * unit_cost), 0) AS stock_value
             FROM inventory_stock_layers
             WHERE remaining_quantity > 0'
        );

        $finishedStock = $this->singleRow(
            'SELECT COALESCE(SUM(remaining_bottles), 0) AS bottles_available,
                    COALESCE(SUM(remaining_bottles * cost_per_bottle), 0) AS stock_value
             FROM finished_goods_layers
             WHERE remaining_bottles > 0'
        );

        $outstanding = (float) $distribution['balance_due'] + (float) $retail['balance_due'];
        $grossRevenue = (float) $distribution['revenue'] + (float) $retail['revenue'];
        $productionCost = (float) ($production['production_cost'] ?? 0);
        $grossProfit = round($grossRevenue - $productionCost, 2);

        Response::success([
            'range' => ['date_from' => $dateFrom, 'date_to' => $dateTo],
            'cards' => [
                'production' => $production,
                'supply' => $supply,
                'distribution' => $distribution,
                'retail' => $retail,
                'raw_stock' => $rawStock,
                'finished_stock' => $finishedStock,
                'gross_revenue' => $grossRevenue,
                'gross_profit' => $grossProfit,
                'outstanding_receivables' => $outstanding,
            ],
        ]);
    }

    public function trends(Request $request): never
    {
        $this->auth->requireRole($request, ['admin']);

        $dateFrom = (string) ($request->query('date_from') ?? '');
        $dateTo = (string) ($request->query('date_to') ?? '');

        if ($dateFrom !== '' && $dateTo !== '') {
            $start = $dateFrom;
            $end = $dateTo;
            $days = max(1, (int) floor((strtotime($end) - strtotime($start)) / 86400) + 1);
        } else {
            $days = max(7, min(366, (int) ($request->query('days') ?? 30)));
            $start = date('Y-m-d', strtotime('-' . ($days - 1) . ' days'));
            $end = date('Y-m-d');
        }

        $production = $this->rows(
            'SELECT production_date AS period,
                    COUNT(*) AS batches_count,
                    COALESCE(SUM(bottles_produced), 0) AS bottles_produced,
                    COALESCE(SUM(total_cost), 0) AS production_cost,
                    COALESCE(SUM(projected_revenue), 0) AS projected_revenue,
                    COALESCE(SUM(projected_profit), 0) AS projected_profit
             FROM production_batches
             WHERE status = "completed"
               AND production_date BETWEEN :date_from AND :date_to
             GROUP BY production_date
             ORDER BY production_date ASC',
            ['date_from' => $start, 'date_to' => $end]
        );

        $supply = $this->rows(
            'SELECT supply_date AS period,
                    COUNT(*) AS receipts_count,
                    COALESCE(SUM(total_cost), 0) AS supply_cost
             FROM supply_receipts
             WHERE status = "received"
               AND supply_date BETWEEN :date_from AND :date_to
             GROUP BY supply_date
             ORDER BY supply_date ASC',
            ['date_from' => $start, 'date_to' => $end]
        );

        $distribution = $this->rows(
            'SELECT order_date AS period,
                    COALESCE(SUM(bottles_issued), 0) AS bottles_distributed,
                    COALESCE(SUM(total_amount), 0) AS revenue
             FROM distributor_orders
             WHERE status = "confirmed"
               AND order_date BETWEEN :date_from AND :date_to
             GROUP BY order_date
             ORDER BY order_date ASC',
            ['date_from' => $start, 'date_to' => $end]
        );

        $retail = $this->rows(
            'SELECT sale_date AS period,
                    COALESCE(SUM(bottles_sold), 0) AS bottles_sold,
                    COALESCE(SUM(total_amount), 0) AS revenue
             FROM retail_sales
             WHERE status = "confirmed"
               AND sale_date BETWEEN :date_from AND :date_to
             GROUP BY sale_date
             ORDER BY sale_date ASC',
            ['date_from' => $start, 'date_to' => $end]
        );

        $productionMap = [];
        foreach ($production as $row) {
            $productionMap[(string) $row['period']] = (float) ($row['production_cost'] ?? 0);
        }
        $distributionMap = [];
        foreach ($distribution as $row) {
            $distributionMap[(string) $row['period']] = (float) ($row['revenue'] ?? 0);
        }
        $retailMap = [];
        foreach ($retail as $row) {
            $retailMap[(string) $row['period']] = (float) ($row['revenue'] ?? 0);
        }

        $combined = [];
        for ($cursor = strtotime($start); $cursor <= strtotime($end); $cursor = strtotime('+1 day', $cursor)) {
            $period = date('Y-m-d', $cursor);
            $productionCost = $productionMap[$period] ?? 0.0;
            $distributionRevenue = $distributionMap[$period] ?? 0.0;
            $retailRevenue = $retailMap[$period] ?? 0.0;
            $totalRevenue = $distributionRevenue + $retailRevenue;
            $combined[] = [
                'period' => $period,
                'production_cost' => round($productionCost, 2),
                'distribution_revenue' => round($distributionRevenue, 2),
                'retail_revenue' => round($retailRevenue, 2),
                'total_revenue' => round($totalRevenue, 2),
                'profit' => round($totalRevenue - $productionCost, 2),
            ];
        }

        Response::success([
            'range' => ['date_from' => $start, 'date_to' => $end, 'days' => $days],
            'series' => [
                'production' => $production,
                'supply' => $supply,
                'distribution' => $distribution,
                'retail' => $retail,
                'combined' => $combined,
            ],
        ]);
    }

    public function alerts(Request $request): never
    {
        $this->auth->requireRole($request, ['admin']);
        $threshold = max(1, (float) ($request->query('stock_threshold') ?? 20));

        $lowStock = $this->rows(
            'SELECT p.id AS parameter_id,
                    p.name AS parameter_name,
                    p.code AS parameter_code,
                    p.quantity_unit,
                    p.default_quantity,
                    COALESCE(SUM(l.remaining_quantity), 0) AS quantity_in_stock
             FROM production_parameters p
             LEFT JOIN inventory_stock_layers l
               ON l.parameter_id = p.id
              AND l.remaining_quantity > 0
             GROUP BY p.id, p.name, p.code, p.quantity_unit, p.default_quantity
             HAVING quantity_in_stock <= :threshold
             ORDER BY quantity_in_stock ASC, p.name ASC',
            ['threshold' => $threshold]
        );

        $outstandingDistributors = $this->rows(
            'SELECT o.id,
                    o.order_number,
                    o.order_date,
                    d.name AS distributor_name,
                    o.balance_due
             FROM distributor_orders o
             INNER JOIN distributors d ON d.id = o.distributor_id
             WHERE o.status = "confirmed"
               AND o.balance_due > 0
             ORDER BY o.balance_due DESC, o.order_date ASC
             LIMIT 20'
        );

        $outstandingRetail = $this->rows(
            'SELECT id,
                    sale_number,
                    sale_date,
                    customer_name,
                    balance_due
             FROM retail_sales
             WHERE status = "confirmed"
               AND balance_due > 0
             ORDER BY balance_due DESC, sale_date ASC
             LIMIT 20'
        );

        $finishedGoods = $this->singleRow(
            'SELECT COALESCE(SUM(remaining_bottles), 0) AS bottles_available
             FROM finished_goods_layers
             WHERE remaining_bottles > 0'
        );

        Response::success([
            'stock_threshold' => $threshold,
            'low_stock_parameters' => $lowStock,
            'outstanding_distributor_orders' => $outstandingDistributors,
            'outstanding_retail_sales' => $outstandingRetail,
            'finished_goods' => $finishedGoods,
        ]);
    }

    public function activity(Request $request): never
    {
        $this->auth->requireRole($request, ['admin']);
        $limit = max(5, min(50, (int) ($request->query('limit') ?? 20)));

        $items = $this->rows(
            "SELECT type, reference_number, activity_date, title, quantity, amount, status
             FROM (
                SELECT 'supply' AS type,
                       receipt_number AS reference_number,
                       supply_date AS activity_date,
                       COALESCE(supplier_name, 'Supply receipt') AS title,
                       NULL AS quantity,
                       total_cost AS amount,
                       status
                FROM supply_receipts
                UNION ALL
                SELECT 'production' AS type,
                       batch_number AS reference_number,
                       production_date AS activity_date,
                       'Production batch' AS title,
                       bottles_produced AS quantity,
                       total_cost AS amount,
                       status
                FROM production_batches
                UNION ALL
                SELECT 'distribution' AS type,
                       order_number AS reference_number,
                       order_date AS activity_date,
                       'Distributor order' AS title,
                       bottles_issued AS quantity,
                       total_amount AS amount,
                       status
                FROM distributor_orders
                UNION ALL
                SELECT 'retail' AS type,
                       sale_number AS reference_number,
                       sale_date AS activity_date,
                       COALESCE(customer_name, 'Retail sale') AS title,
                       bottles_sold AS quantity,
                       total_amount AS amount,
                       status
                FROM retail_sales
             ) activities
             ORDER BY activity_date DESC, reference_number DESC
             LIMIT $limit"
        );

        Response::success(['data' => $items]);
    }

    private function resolveDateRange(Request $request): array
    {
        $dateFrom = (string) ($request->query('date_from') ?? date('Y-m-01'));
        $dateTo = (string) ($request->query('date_to') ?? date('Y-m-d'));

        return [$dateFrom, $dateTo];
    }

    private function singleRow(string $sql, array $params = []): array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetch() ?: [];
    }

    private function rows(string $sql, array $params = []): array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }
}
