<?php

declare(strict_types=1);

namespace App\Support;

class Response
{
    public static function json(array $payload, int $status = 200, array $headers = []): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        foreach ($headers as $header => $value) {
            header($header . ': ' . $value);
        }

        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function success(array $data = [], int $status = 200): never
    {
        self::json(['success' => true] + $data, $status);
    }

    public static function error(string $message, int $status, array $errors = []): never
    {
        self::json([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], $status);
    }
}
