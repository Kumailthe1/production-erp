<?php

declare(strict_types=1);

namespace App\Docs;

use OpenApi\Annotations as OA;

/**
 * @OA\Get(
 *   path="/dashboard/overview",
 *   tags={"Dashboard"},
 *   summary="Return top-level KPI cards across production, supply, distribution, sales, and stock",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="date_from", in="query", @OA\Schema(type="string", format="date", example="2026-03-01")),
 *   @OA\Parameter(name="date_to", in="query", @OA\Schema(type="string", format="date", example="2026-03-31")),
 *   @OA\Response(response=200, description="Dashboard overview returned")
 * )
 *
 * @OA\Get(
 *   path="/dashboard/trends",
 *   tags={"Dashboard"},
 *   summary="Return trend series for production, supply, distribution, and retail over the last N days",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="days", in="query", @OA\Schema(type="integer", example=30)),
 *   @OA\Response(response=200, description="Dashboard trends returned")
 * )
 *
 * @OA\Get(
 *   path="/dashboard/alerts",
 *   tags={"Dashboard"},
 *   summary="Return low-stock alerts, outstanding balances, and finished-goods warning data",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="stock_threshold", in="query", @OA\Schema(type="number", format="float", example=20)),
 *   @OA\Response(response=200, description="Dashboard alerts returned")
 * )
 *
 * @OA\Get(
 *   path="/dashboard/activity",
 *   tags={"Dashboard"},
 *   summary="Return recent activity feed from supply, production, distribution, and sales",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="limit", in="query", @OA\Schema(type="integer", example=20)),
 *   @OA\Response(response=200, description="Dashboard activity returned")
 * )
 */
final class DashboardOpenApi
{
}
