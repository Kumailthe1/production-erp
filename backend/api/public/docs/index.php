<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/src/Config/bootstrap.php';

$docsConfig = require dirname(__DIR__, 2) . '/config/docs.php';
$requestedVersion = strtolower((string) ($_GET['v'] ?? 'v1'));
$versions = $docsConfig['versions'] ?? [];
if (!isset($versions[$requestedVersion])) {
    $requestedVersion = 'v1';
}

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

$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
$basePath = rtrim((string) dirname($scriptDir), '/');
if ($basePath === '.' || $basePath === '/') {
    $basePath = '';
}

$apiJsonUrl = ($basePath === '' ? '' : $basePath) . '/openapi/' . rawurlencode($requestedVersion) . '.json';
$docsConfig['logo'] = ($basePath === '' ? '' : $basePath) . '/docs/assets/logo.jpg';
header('Cache-Control: public, max-age=' . (int) env('API_DOCS_CACHE_SECONDS', 300));

require dirname(__DIR__) . '/views/docs.php';
