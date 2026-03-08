<?php

declare(strict_types=1);

namespace App\Docs;

use OpenApi\Annotations as OA;

/**
 * @OA\Schema(
 *   schema="DistributorRequest",
 *   type="object",
 *   required={"name"},
 *   @OA\Property(property="name", type="string", example="Main Street Distributor"),
 *   @OA\Property(property="phone", type="string", example="08030000000"),
 *   @OA\Property(property="email", type="string", format="email", example="distributor@example.com"),
 *   @OA\Property(property="address", type="string", example="Kano depot"),
 *   @OA\Property(property="status", type="string", example="active"),
 *   @OA\Property(property="notes", type="string", example="Pays outstanding balances weekly")
 * )
 *
 * @OA\Schema(
 *   schema="DistributionOrderRequest",
 *   type="object",
 *   required={"order_number","distributor_id","order_date","bottles_issued","unit_price"},
 *   @OA\Property(property="order_number", type="string", example="DIST-2026-0001"),
 *   @OA\Property(property="distributor_id", type="integer", example=1),
 *   @OA\Property(property="order_date", type="string", format="date", example="2026-03-07"),
 *   @OA\Property(property="bottles_issued", type="integer", example=600),
 *   @OA\Property(property="unit_price", type="number", format="float", example=1000),
 *   @OA\Property(property="payment_type", type="string", example="partial"),
 *   @OA\Property(property="initial_payment", type="number", format="float", example=420000),
 *   @OA\Property(property="payment_method", type="string", example="transfer"),
 *   @OA\Property(property="status", type="string", example="confirmed"),
 *   @OA\Property(property="notes", type="string", example="Distributor will balance on next restock")
 * )
 *
 * @OA\Schema(
 *   schema="RetailSaleRequest",
 *   type="object",
 *   required={"sale_number","sale_date","bottles_sold","unit_price"},
 *   @OA\Property(property="sale_number", type="string", example="SALE-2026-0001"),
 *   @OA\Property(property="sale_date", type="string", format="date", example="2026-03-07"),
 *   @OA\Property(property="customer_name", type="string", example="Walk-in customer"),
 *   @OA\Property(property="customer_phone", type="string", example="08030000001"),
 *   @OA\Property(property="bottles_sold", type="integer", example=24),
 *   @OA\Property(property="unit_price", type="number", format="float", example=1200),
 *   @OA\Property(property="payment_type", type="string", example="cash"),
 *   @OA\Property(property="initial_payment", type="number", format="float", example=28800),
 *   @OA\Property(property="payment_method", type="string", example="cash"),
 *   @OA\Property(property="status", type="string", example="confirmed"),
 *   @OA\Property(property="notes", type="string", example="Immediate retail sale")
 * )
 *
 * @OA\Schema(
 *   schema="PaymentRequest",
 *   type="object",
 *   required={"amount"},
 *   @OA\Property(property="payment_date", type="string", format="date", example="2026-03-08"),
 *   @OA\Property(property="amount", type="number", format="float", example=180000),
 *   @OA\Property(property="payment_method", type="string", example="transfer"),
 *   @OA\Property(property="notes", type="string", example="Part balance payment")
 * )
 *
 * @OA\Get(
 *   path="/distributors",
 *   tags={"Distribution"},
 *   summary="List distributors",
 *   security={{"bearerAuth":{}}},
 *   @OA\Response(response=200, description="Distributors returned")
 * )
 *
 * @OA\Get(
 *   path="/distributors/{id}",
 *   tags={"Distribution"},
 *   summary="Fetch one distributor",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Distributor returned"),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Post(
 *   path="/distributors",
 *   tags={"Distribution"},
 *   summary="Create a distributor",
 *   security={{"bearerAuth":{}}},
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/DistributorRequest")),
 *   @OA\Response(response=201, description="Distributor created")
 * )
 *
 * @OA\Patch(
 *   path="/distributors/{id}",
 *   tags={"Distribution"},
 *   summary="Update a distributor",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/DistributorRequest")),
 *   @OA\Response(response=200, description="Distributor updated")
 * )
 *
 * @OA\Delete(
 *   path="/distributors/{id}",
 *   tags={"Distribution"},
 *   summary="Delete a distributor",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Distributor deleted")
 * )
 *
 * @OA\Get(
 *   path="/distribution/orders",
 *   tags={"Distribution"},
 *   summary="List distributor orders",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="distributor_id", in="query", @OA\Schema(type="integer", example=1)),
 *   @OA\Parameter(name="status", in="query", @OA\Schema(type="string", example="confirmed")),
 *   @OA\Response(response=200, description="Distributor orders returned")
 * )
 *
 * @OA\Get(
 *   path="/distribution/orders/{id}",
 *   tags={"Distribution"},
 *   summary="Fetch one distributor order with payments",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Distributor order returned")
 * )
 *
 * @OA\Post(
 *   path="/distribution/orders",
 *   tags={"Distribution"},
 *   summary="Create a distributor order and optionally collect an initial payment",
 *   security={{"bearerAuth":{}}},
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/DistributionOrderRequest")),
 *   @OA\Response(response=201, description="Distributor order created")
 * )
 *
 * @OA\Patch(
 *   path="/distribution/orders/{id}",
 *   tags={"Distribution"},
 *   summary="Update a distributor order",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/DistributionOrderRequest")),
 *   @OA\Response(response=200, description="Distributor order updated")
 * )
 *
 * @OA\Delete(
 *   path="/distribution/orders/{id}",
 *   tags={"Distribution"},
 *   summary="Delete a distributor order",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Distributor order deleted")
 * )
 *
 * @OA\Post(
 *   path="/distribution/orders/{id}/payments",
 *   tags={"Distribution"},
 *   summary="Add a payment to a distributor order",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/PaymentRequest")),
 *   @OA\Response(response=201, description="Payment created")
 * )
 *
 * @OA\Get(
 *   path="/distribution/analytics",
 *   tags={"Distribution"},
 *   summary="Distributor sales and outstanding balance summary",
 *   security={{"bearerAuth":{}}},
 *   @OA\Response(response=200, description="Distribution analytics returned")
 * )
 *
 * @OA\Get(
 *   path="/sales/stock",
 *   tags={"Sales"},
 *   summary="Show finished bottle stock available for distribution and retail sale",
 *   security={{"bearerAuth":{}}},
 *   @OA\Response(response=200, description="Finished goods stock returned")
 * )
 *
 * @OA\Get(
 *   path="/sales/retail",
 *   tags={"Sales"},
 *   summary="List retail sales",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="status", in="query", @OA\Schema(type="string", example="confirmed")),
 *   @OA\Response(response=200, description="Retail sales returned")
 * )
 *
 * @OA\Get(
 *   path="/sales/retail/{id}",
 *   tags={"Sales"},
 *   summary="Fetch one retail sale with payments",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Retail sale returned")
 * )
 *
 * @OA\Post(
 *   path="/sales/retail",
 *   tags={"Sales"},
 *   summary="Create a retail sale and optionally collect an initial payment",
 *   security={{"bearerAuth":{}}},
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/RetailSaleRequest")),
 *   @OA\Response(response=201, description="Retail sale created")
 * )
 *
 * @OA\Patch(
 *   path="/sales/retail/{id}",
 *   tags={"Sales"},
 *   summary="Update a retail sale",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/RetailSaleRequest")),
 *   @OA\Response(response=200, description="Retail sale updated")
 * )
 *
 * @OA\Delete(
 *   path="/sales/retail/{id}",
 *   tags={"Sales"},
 *   summary="Delete a retail sale",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Retail sale deleted")
 * )
 *
 * @OA\Post(
 *   path="/sales/retail/{id}/payments",
 *   tags={"Sales"},
 *   summary="Add a payment to a retail sale",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/PaymentRequest")),
 *   @OA\Response(response=201, description="Retail payment created")
 * )
 *
 * @OA\Get(
 *   path="/sales/analytics",
 *   tags={"Sales"},
 *   summary="Retail sales summary",
 *   security={{"bearerAuth":{}}},
 *   @OA\Response(response=200, description="Retail sales analytics returned")
 * )
 */
final class DistributionSalesOpenApi
{
}
