<?php

declare(strict_types=1);

namespace App\Support;

class Request
{
    private ?array $json = null;

    public function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public function path(): string
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
        if ($scriptDir !== '' && $scriptDir !== '/' && str_starts_with($path, $scriptDir)) {
            $path = substr($path, strlen($scriptDir)) ?: '/';
        }

        return '/' . trim($path, '/');
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $_GET[$key] ?? $default;
    }

    public function queryArray(): array
    {
        return $_GET;
    }

    public function input(?string $key = null, mixed $default = null): mixed
    {
        $payload = $this->all();
        if ($key === null) {
            return $payload;
        }

        return $payload[$key] ?? $default;
    }

    public function all(): array
    {
        if ($this->json !== null) {
            return $this->json;
        }

        $contentType = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
        if (str_contains($contentType, 'application/json')) {
            $decoded = json_decode(file_get_contents('php://input') ?: '{}', true);
            $this->json = is_array($decoded) ? $decoded : [];
            return $this->json;
        }

        $this->json = $_POST;
        return $this->json;
    }

    public function header(string $key, mixed $default = null): mixed
    {
        $lookup = 'HTTP_' . strtoupper(str_replace('-', '_', $key));
        return $_SERVER[$lookup] ?? $default;
    }
}
