<?php

declare(strict_types=1);

return [
    'title' => (string) env('API_DOCS_TITLE', 'Amsal ERP API'),
    'description' => (string) env(
        'API_DOCS_DESCRIPTION',
        'Interactive API reference for the Amsal fermented milk ERP backend.'
    ),
    'logo' => (string) env('API_DOCS_LOGO', '/erp-api/docs/assets/logo.jpg'),
    'layout' => 'sidebar',
    'theme' => (string) env('API_DOCS_THEME', 'system'),
    'hide_try_it' => false,
    'hide_schemas' => false,
    'versions' => [
        'v1' => [
            'label' => 'v1',
            'file' => dirname(__DIR__) . '/public/openapi/v1.json',
        ],
        'v2' => [
            'label' => 'v2',
            'file' => dirname(__DIR__) . '/public/openapi/v2.json',
        ],
    ],
];
