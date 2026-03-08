<?php

declare(strict_types=1);

use OpenApi\Generator;

require_once dirname(__DIR__) . '/src/Config/bootstrap.php';

$outputPath = dirname(__DIR__) . '/public/openapi/v1.json';
$scanPath = dirname(__DIR__) . '/src';

if (!class_exists(Generator::class)) {
    fwrite(STDERR, "swagger-php is not installed. Run: composer install\n");
    exit(1);
}

$openapi = Generator::scan([$scanPath]);
file_put_contents($outputPath, $openapi->toJson());

echo "OpenAPI spec written to {$outputPath}\n";
