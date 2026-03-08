<?php

declare(strict_types=1);

namespace App\Docs;

use OpenApi\Annotations as OA;

/**
 * @OA\Info(
 *   version="1.0.0",
 *   title="Amsal ERP API",
 *   description="Backend API for authentication, production settings, production batches, and leftover-aware costing."
 * )
 *
 * @OA\Server(
 *   url="http://localhost/dashboard/amsal-inventory/backend/api/public/api/v1",
 *   description="Primary API server"
 * )
 *
 * @OA\SecurityScheme(
 *   securityScheme="bearerAuth",
 *   type="http",
 *   scheme="bearer",
 *   bearerFormat="Opaque Token"
 * )
 *
 * @OA\Schema(
 *   schema="ErrorResponse",
 *   type="object",
 *   @OA\Property(property="success", type="boolean", example=false),
 *   @OA\Property(property="message", type="string", example="Validation failed."),
 *   @OA\Property(
 *     property="errors",
 *     type="object",
 *     additionalProperties=@OA\Schema(type="array", @OA\Items(type="string"))
 *   )
 * )
 *
 * @OA\Schema(
 *   schema="LoginRequest",
 *   type="object",
 *   required={"email","password"},
 *   @OA\Property(property="email", type="string", format="email", example="admin@amsal.test"),
 *   @OA\Property(property="password", type="string", format="password", example="SecurePass123")
 * )
 *
 * @OA\Schema(
 *   schema="ProductionSettingRequest",
 *   type="object",
 *   required={"name","parameter_kind","quantity_unit"},
 *   @OA\Property(property="name", type="string", example="Milk"),
 *   @OA\Property(property="code", type="string", example="milk"),
 *   @OA\Property(property="parameter_kind", type="string", enum={"input","packaging","config","output"}, example="input"),
 *   @OA\Property(property="quantity_unit", type="string", example="kg"),
 *   @OA\Property(property="unit_cost", type="number", format="float", example=850),
 *   @OA\Property(property="default_quantity", type="number", format="float", example=12),
 *   @OA\Property(property="notes", type="string", example="Fresh cow milk cost per kg"),
 *   @OA\Property(property="sort_order", type="integer", example=10),
 *   @OA\Property(property="is_active", type="boolean", example=true)
 * )
 *
 * @OA\Schema(
 *   schema="ProductionBatchItemRequest",
 *   type="object",
 *   required={"parameter_id"},
 *   @OA\Property(property="parameter_id", type="integer", example=1),
 *   @OA\Property(property="new_quantity_added", type="number", format="float", example=12),
 *   @OA\Property(property="closing_leftover_quantity", type="number", format="float", example=1.5),
 *   @OA\Property(property="notes", type="string", example="1.5kg milk remained after processing")
 * )
 *
 * @OA\Schema(
 *   schema="ProductionBatchRequest",
 *   type="object",
 *   required={"batch_number","production_date","batch_size_liters","bottles_produced","selling_price_per_bottle","items"},
 *   @OA\Property(property="batch_number", type="string", example="BATCH-2026-0001"),
 *   @OA\Property(property="production_date", type="string", format="date", example="2026-03-07"),
 *   @OA\Property(property="batch_size_liters", type="number", format="float", example=50),
 *   @OA\Property(property="bottles_produced", type="integer", example=100),
 *   @OA\Property(property="selling_price_per_bottle", type="number", format="float", example=500),
 *   @OA\Property(property="status", type="string", example="completed"),
 *   @OA\Property(property="notes", type="string", example="Morning fermented milk production"),
 *   @OA\Property(property="items", type="array", @OA\Items(ref="#/components/schemas/ProductionBatchItemRequest"))
 * )
 *
 * @OA\Schema(
 *   schema="SupplyReceiptItemRequest",
 *   type="object",
 *   required={"parameter_id","quantity_received","unit_cost"},
 *   @OA\Property(property="parameter_id", type="integer", example=1),
 *   @OA\Property(property="quantity_received", type="number", format="float", example=50),
 *   @OA\Property(property="unit_cost", type="number", format="float", example=1450),
 *   @OA\Property(property="notes", type="string", example="One full bag supplied into store")
 * )
 *
 * @OA\Schema(
 *   schema="SupplyReceiptRequest",
 *   type="object",
 *   required={"receipt_number","supply_date","items"},
 *   @OA\Property(property="receipt_number", type="string", example="SUP-2026-0001"),
 *   @OA\Property(property="supply_date", type="string", format="date", example="2026-03-07"),
 *   @OA\Property(property="supplier_name", type="string", example="Amsal Raw Materials"),
 *   @OA\Property(property="status", type="string", example="received"),
 *   @OA\Property(property="notes", type="string", example="Morning store restock"),
 *   @OA\Property(property="items", type="array", @OA\Items(ref="#/components/schemas/SupplyReceiptItemRequest"))
 * )
 *
 * @OA\Post(
 *   path="/auth/register",
 *   tags={"Auth"},
 *   summary="Create an admin or staff account for development and seeding workflows",
 *   @OA\RequestBody(
 *     required=true,
 *     @OA\JsonContent(
 *       required={"full_name","email","password","role"},
 *       @OA\Property(property="full_name", type="string", example="Amsal Admin"),
 *       @OA\Property(property="email", type="string", format="email", example="admin@amsal.test"),
 *       @OA\Property(property="phone", type="string", example="08030000000"),
 *       @OA\Property(property="password", type="string", format="password", example="SecurePass123"),
 *       @OA\Property(property="role", type="string", enum={"admin","staff"}, example="admin")
 *     )
 *   ),
 *   @OA\Response(response=201, description="Account created"),
 *   @OA\Response(response=400, description="Bad request", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=500, description="Server error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Post(
 *   path="/auth/login",
 *   tags={"Auth"},
 *   summary="Authenticate a user and issue a bearer token",
 *   @OA\RequestBody(
 *     required=true,
 *     @OA\JsonContent(ref="#/components/schemas/LoginRequest")
 *   ),
 *   @OA\Response(
 *     response=200,
 *     description="Authenticated successfully",
 *     @OA\JsonContent(
 *       type="object",
 *       @OA\Property(property="success", type="boolean", example=true),
 *       @OA\Property(property="message", type="string", example="Login successful."),
 *       @OA\Property(
 *         property="data",
 *         type="object",
 *         @OA\Property(property="token", type="string"),
 *         @OA\Property(property="token_type", type="string", example="Bearer"),
 *         @OA\Property(property="expires_at", type="string", format="date-time")
 *       )
 *     )
 *   ),
 *   @OA\Response(response=400, description="Bad request", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=500, description="Server error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Get(
  *   path="/production/settings",
 *   tags={"Production Settings"},
 *   summary="List production parameters",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="parameter_kind", in="query", description="Filter by parameter category", @OA\Schema(type="string", example="input")),
 *   @OA\Parameter(name="is_active", in="query", description="Optional active-state filter for future extension", @OA\Schema(type="boolean")),
 *   @OA\Response(response=200, description="Settings list returned"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=500, description="Server error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Get(
 *   path="/production/settings/{id}",
 *   tags={"Production Settings"},
 *   summary="Fetch one production parameter",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Setting returned"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Post(
 *   path="/production/settings",
 *   tags={"Production Settings"},
 *   summary="Create a production parameter",
 *   security={{"bearerAuth":{}}},
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/ProductionSettingRequest")),
 *   @OA\Response(response=201, description="Setting created"),
 *   @OA\Response(response=400, description="Bad request", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=500, description="Server error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Patch(
 *   path="/production/settings/{id}",
 *   tags={"Production Settings"},
 *   summary="Update a production parameter",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/ProductionSettingRequest")),
 *   @OA\Response(response=200, description="Setting updated"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Delete(
 *   path="/production/settings/{id}",
 *   tags={"Production Settings"},
 *   summary="Delete a production parameter",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Setting deleted"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Get(
 *   path="/production/batches",
 *   tags={"Production Batches"},
 *   summary="List production batches",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="date_from", in="query", @OA\Schema(type="string", format="date", example="2026-03-01")),
 *   @OA\Parameter(name="date_to", in="query", @OA\Schema(type="string", format="date", example="2026-03-31")),
 *   @OA\Parameter(name="status", in="query", @OA\Schema(type="string", example="completed")),
 *   @OA\Response(response=200, description="Batch list returned"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Post(
 *   path="/production/batches",
 *   tags={"Production Batches"},
 *   summary="Create a production batch with leftover-aware costing",
 *   security={{"bearerAuth":{}}},
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/ProductionBatchRequest")),
 *   @OA\Response(response=201, description="Batch created"),
 *   @OA\Response(response=400, description="Bad request", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=500, description="Server error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Get(
 *   path="/production/batches/{id}",
 *   tags={"Production Batches"},
 *   summary="Fetch one production batch with computed line items",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Batch returned"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Patch(
 *   path="/production/batches/{id}",
 *   tags={"Production Batches"},
 *   summary="Update an existing production batch and rebuild dependent leftovers",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/ProductionBatchRequest")),
 *   @OA\Response(response=200, description="Batch updated"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Delete(
 *   path="/production/batches/{id}",
 *   tags={"Production Batches"},
 *   summary="Delete a production batch and rebuild dependent leftovers",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Batch deleted"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Get(
 *   path="/production/leftovers",
 *   tags={"Production Batches"},
 *   summary="List active leftover layers that will feed the next production run",
 *   security={{"bearerAuth":{}}},
 *   @OA\Response(response=200, description="Active leftovers returned"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Get(
 *   path="/supply/receipts",
 *   tags={"Supply"},
 *   summary="List supply receipts",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="date_from", in="query", @OA\Schema(type="string", format="date", example="2026-03-01")),
 *   @OA\Parameter(name="date_to", in="query", @OA\Schema(type="string", format="date", example="2026-03-31")),
 *   @OA\Parameter(name="status", in="query", @OA\Schema(type="string", example="received")),
 *   @OA\Response(response=200, description="Supply receipt list returned"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Get(
 *   path="/supply/receipts/{id}",
 *   tags={"Supply"},
 *   summary="Fetch one supply receipt with its stock items",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Supply receipt returned"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Post(
 *   path="/supply/receipts",
 *   tags={"Supply"},
 *   summary="Create a supply receipt and add materials into store stock",
 *   security={{"bearerAuth":{}}},
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/SupplyReceiptRequest")),
 *   @OA\Response(response=201, description="Supply receipt created"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Patch(
 *   path="/supply/receipts/{id}",
 *   tags={"Supply"},
 *   summary="Update a supply receipt and rebuild dependent stock balances",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/SupplyReceiptRequest")),
 *   @OA\Response(response=200, description="Supply receipt updated"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Delete(
 *   path="/supply/receipts/{id}",
 *   tags={"Supply"},
 *   summary="Delete a supply receipt and rebuild stock balances",
 *   security={{"bearerAuth":{}}},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer", example=1)),
 *   @OA\Response(response=200, description="Supply receipt deleted"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 *
 * @OA\Get(
 *   path="/supply/stock-balances",
 *   tags={"Supply"},
 *   summary="List current stock balances in store by production parameter",
 *   security={{"bearerAuth":{}}},
 *   @OA\Response(response=200, description="Stock balances returned"),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/ErrorResponse"))
 * )
 */
final class OpenApi
{
}
