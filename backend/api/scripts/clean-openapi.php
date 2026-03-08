<?php

declare(strict_types=1);

$file = dirname(__DIR__) . '/public/openapi/v1.json';
if (is_file($file)) {
    unlink($file);
}

echo "OpenAPI v1 JSON output cleaned.\n";
