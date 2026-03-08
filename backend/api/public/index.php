<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\DistributorController;
use App\Controllers\DistributionOrderController;
use App\Controllers\PackagingSizeController;
use App\Controllers\ProductionBatchController;
use App\Controllers\ProductionSettingController;
use App\Controllers\RetailSaleController;
use App\Controllers\SupplyReceiptController;
use App\Services\FinishedGoodsService;
use App\Services\InventoryStockService;
use App\Services\ProductionCostingService;
use App\Services\StateRebuildService;
use App\Support\ApiException;
use App\Support\Auth;
use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use App\Support\Router;

require_once dirname(__DIR__) . '/src/Config/bootstrap.php';

$allowedOrigins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'))
)));
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($requestOrigin !== '' && in_array($requestOrigin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Vary: Origin');
}

header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');
header('Access-Control-Max-Age: 86400');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$request = new Request();
$router = new Router();
try {
    $db = Database::connection();
} catch (\Throwable $throwable) {
    Response::error(
        env('APP_DEBUG', false) ? $throwable->getMessage() : 'Database connection failed.',
        500
    );
}
$auth = new Auth($db);
$inventory = new InventoryStockService($db);
$costing = new ProductionCostingService($db);
$finishedGoods = new FinishedGoodsService($db);
$state = new StateRebuildService($inventory, $costing, $finishedGoods);

$authController = new AuthController($db, $auth);
$dashboardController = new DashboardController($db, $auth);
$distributorController = new DistributorController($db, $auth, $state);
$distributionOrderController = new DistributionOrderController($db, $auth, $state);
$settingsController = new ProductionSettingController($db, $auth, $state);
$packagingSizeController = new PackagingSizeController($db, $auth);
$batchController = new ProductionBatchController($db, $auth, $state);
$retailSaleController = new RetailSaleController($db, $auth, $state);
$supplyController = new SupplyReceiptController($db, $auth, $state);

$docsConfig = require dirname(__DIR__) . '/config/docs.php';

$serveDocs = static function () use ($docsConfig): void {
    $username = (string) env('API_DOCS_USERNAME', '');
    $password = (string) env('API_DOCS_PASSWORD', '');
    $allowlist = array_values(array_filter(array_map('trim', explode(',', (string) env('API_DOCS_IP_ALLOWLIST', '')))));
    $remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';

    if ($allowlist !== [] && !in_array($remoteIp, $allowlist, true)) {
        http_response_code(403);
        exit('Docs access denied for this IP address.');
    }

    if ($username !== '' && $password !== '') {
        $providedUser = $_SERVER['PHP_AUTH_USER'] ?? '';
        $providedPass = $_SERVER['PHP_AUTH_PW'] ?? '';

        if ($providedUser !== $username || $providedPass !== $password) {
            header('WWW-Authenticate: Basic realm="Amsal API Docs"');
            http_response_code(401);
            exit('Authentication required.');
        }
    }

    $requestedVersion = strtolower((string) ($_GET['v'] ?? 'v1'));
    $versions = $docsConfig['versions'] ?? [];
    if (!isset($versions[$requestedVersion])) {
        $requestedVersion = 'v1';
    }

    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
    $basePath = $scriptDir === '' ? '' : $scriptDir;
    $apiJsonUrl = ($basePath === '' ? '' : $basePath) . '/openapi/' . rawurlencode($requestedVersion) . '.json';
    $docsConfig['logo'] = ($basePath === '' ? '' : $basePath) . '/docs/assets/logo.jpg';
    header('Cache-Control: public, max-age=' . (int) env('API_DOCS_CACHE_SECONDS', 300));

    require dirname(__DIR__) . '/public/views/docs.php';
    exit;
};

$serveApiJson = static function () use ($docsConfig): void {
    $requestedVersion = strtolower((string) ($_GET['v'] ?? 'v1'));
    $versions = $docsConfig['versions'] ?? [];
    if (!isset($versions[$requestedVersion])) {
        Response::error('API spec version not found.', 404);
    }

    $file = $versions[$requestedVersion]['file'];
    if (!is_file($file)) {
        Response::error('API spec file is missing.', 404);
    }

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=' . (int) env('API_DOCS_CACHE_SECONDS', 300));
    readfile($file);
    exit;
};

$router->add('GET', '/docs', $serveDocs);
$router->add('GET', '/api.json', $serveApiJson);
$router->add('POST', '/api/v1/auth/register', [$authController, 'register']);
$router->add('POST', '/api/v1/auth/login', [$authController, 'login']);
$router->add('GET', '/api/v1/auth/users', [$authController, 'users']);

$router->add('GET', '/api/v1/dashboard/overview', [$dashboardController, 'overview']);
$router->add('GET', '/api/v1/dashboard/trends', [$dashboardController, 'trends']);
$router->add('GET', '/api/v1/dashboard/alerts', [$dashboardController, 'alerts']);
$router->add('GET', '/api/v1/dashboard/activity', [$dashboardController, 'activity']);

$router->add('GET', '/api/v1/production/settings', [$settingsController, 'index']);
$router->add('GET', '/api/v1/production/settings/{id}', [$settingsController, 'show']);
$router->add('POST', '/api/v1/production/settings', [$settingsController, 'store']);
$router->add('PATCH', '/api/v1/production/settings/{id}', [$settingsController, 'update']);
$router->add('DELETE', '/api/v1/production/settings/{id}', [$settingsController, 'destroy']);
 
$router->add('GET', '/api/v1/production/packaging-sizes', [$packagingSizeController, 'index']);
$router->add('POST', '/api/v1/production/packaging-sizes', [$packagingSizeController, 'store']);
$router->add('PATCH', '/api/v1/production/packaging-sizes/{id}', [$packagingSizeController, 'update']);
$router->add('DELETE', '/api/v1/production/packaging-sizes/{id}', [$packagingSizeController, 'destroy']);

$router->add('GET', '/api/v1/production/batches', [$batchController, 'index']);
$router->add('GET', '/api/v1/production/batches/{id}', [$batchController, 'show']);
$router->add('GET', '/api/v1/production/leftovers', [$batchController, 'leftovers']);
$router->add('POST', '/api/v1/production/batches', [$batchController, 'store']);
$router->add('PATCH', '/api/v1/production/batches/{id}', [$batchController, 'update']);
$router->add('DELETE', '/api/v1/production/batches/{id}', [$batchController, 'destroy']);

$router->add('GET', '/api/v1/supply/stock-balances', [$supplyController, 'stockBalances']);
$router->add('GET', '/api/v1/supply/receipts', [$supplyController, 'index']);
$router->add('GET', '/api/v1/supply/receipts/{id}', [$supplyController, 'show']);
$router->add('POST', '/api/v1/supply/receipts', [$supplyController, 'store']);
$router->add('PATCH', '/api/v1/supply/receipts/{id}', [$supplyController, 'update']);
$router->add('DELETE', '/api/v1/supply/receipts/{id}', [$supplyController, 'destroy']);

$router->add('GET', '/api/v1/distributors', [$distributorController, 'index']);
$router->add('GET', '/api/v1/distributors/{id}', [$distributorController, 'show']);
$router->add('POST', '/api/v1/distributors', [$distributorController, 'store']);
$router->add('PATCH', '/api/v1/distributors/{id}', [$distributorController, 'update']);
$router->add('DELETE', '/api/v1/distributors/{id}', [$distributorController, 'destroy']);

$router->add('GET', '/api/v1/distribution/orders', [$distributionOrderController, 'index']);
$router->add('GET', '/api/v1/distribution/orders/{id}', [$distributionOrderController, 'show']);
$router->add('POST', '/api/v1/distribution/orders', [$distributionOrderController, 'store']);
$router->add('PATCH', '/api/v1/distribution/orders/{id}', [$distributionOrderController, 'update']);
$router->add('DELETE', '/api/v1/distribution/orders/{id}', [$distributionOrderController, 'destroy']);
$router->add('POST', '/api/v1/distribution/orders/{id}/payments', [$distributionOrderController, 'addPayment']);
$router->add('GET', '/api/v1/distribution/analytics', [$distributionOrderController, 'analytics']);

$router->add('GET', '/api/v1/sales/retail', [$retailSaleController, 'index']);
$router->add('GET', '/api/v1/sales/retail/{id}', [$retailSaleController, 'show']);
$router->add('GET', '/api/v1/sales/stock', [$retailSaleController, 'stock']);
$router->add('POST', '/api/v1/sales/retail', [$retailSaleController, 'store']);
$router->add('PATCH', '/api/v1/sales/retail/{id}', [$retailSaleController, 'update']);
$router->add('DELETE', '/api/v1/sales/retail/{id}', [$retailSaleController, 'destroy']);
$router->add('POST', '/api/v1/sales/retail/{id}/payments', [$retailSaleController, 'addPayment']);
$router->add('GET', '/api/v1/sales/analytics', [$retailSaleController, 'analytics']);

try {
    $router->dispatch($request);
} catch (ApiException $exception) {
    Response::error($exception->getMessage(), $exception->status(), $exception->errors());
} catch (\Throwable $throwable) {
    Response::error(
        env('APP_DEBUG', false) ? $throwable->getMessage() : 'Unexpected server error.',
        500
    );
}
