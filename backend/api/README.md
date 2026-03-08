# Amsal ERP API

This module is the clean PHP backend foundation for the new system. It covers:

- `auth`: developer-facing registration and login with bearer tokens
- `supply`: CRUD for stock receipts into the store and current stock balance reporting
- `production settings`: CRUD for reusable production parameters like milk, sugar, stabilizer, bottle, label price, base batch size, and selling price
- `production batches`: CRUD for production runs with leftover-aware costing and store stock withdrawal
- `leftovers`: active leftover stock carried into the next production
- `docs`: OpenAPI generation with `swagger-php` and Stoplight Elements hosting under `public/docs`

## Folder structure

```text
backend/
  api/
    config/
      docs.php
    composer.json
    .env.example
    public/
      index.php
      docs/
        index.php
      openapi/
        v1.json
        v2.json
      views/
        docs.php
    scripts/
      clean-openapi.php
      generate-openapi.php
      rebuild-docs.sh
    src/
      Config/
      Controllers/
      Docs/
      Services/
      Support/
  database/
    schema.sql
```

## Setup

1. Copy `backend/api/.env.example` to `backend/api/.env`
2. Update your database credentials and docs access settings
3. Create the database and import `backend/database/schema.sql`
4. Optionally import `backend/database/seed_production_basics.sql` for a starter admin user and initial production settings
5. Run Composer inside `backend/api`
6. Rebuild docs JSON

## Composer commands

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api
composer install
composer docs:build
```

## API base URLs

- API: `/dashboard/amsal-inventory/backend/api/public/api/v1`
- Docs UI: `/dashboard/amsal-inventory/backend/api/public/docs`
- Docs JSON: `/dashboard/amsal-inventory/backend/api/public/api.json?v=v1`

## Production model

`production_parameters` stores reusable settings and catalog entries.

Examples:

- `Base Batch Size` as `parameter_kind=config`, unit `liter`
- `Milk`, `Sugar`, `Stabilizer` as `parameter_kind=input`
- `Bottle`, `Label` as `parameter_kind=packaging`
- `Selling Price per Bottle` as `parameter_kind=output`

`production_batches` stores one production run.

`supply_receipts` and `supply_receipt_items` store what was purchased into the store.

`inventory_stock_layers` tracks what is still available in the store after supply receipts and production withdrawals.

`production_batch_items` stores the quantity newly added for the run, what was issued from store stock, and the closing leftover quantity after production.

`production_leftover_layers` stores unconsumed balance with its original cost. During rebuild, the system consumes older leftover layers first and only then uses newly added stock. This preserves previous costs when prices change between productions.

## Versioning docs

- Keep generated docs in `public/openapi/v1.json`, `v2.json`, and so on
- Duplicate the top-level annotation file when a breaking change starts
- Serve versions from `/api.json?v=v1` and `/api.json?v=v2`

## Production-safe docs

- No DB secrets are committed; everything comes from `.env`
- Docs route supports IP allowlist and HTTP Basic auth
- Cache headers are applied from `API_DOCS_CACHE_SECONDS`
- Docs UI is rendered with Stoplight Elements from the official web-component bundle
- Use the `.htaccess.example` file if you prefer Apache-level protection
- Use [public/.htaccess](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api/public/.htaccess) or [nginx.conf.example](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api/nginx.conf.example) for front-controller routing

## Troubleshooting

- `Class OpenApi\Generator not found`: run `composer install`
- Empty JSON spec: ensure annotations stay inside `backend/api/src`
- `Route not found`: confirm the request path includes `/backend/api/public/api/v1/...`
- 401 on secured endpoints: send `Authorization: Bearer <token>`
- 422 on production batch creation: one of the batch items has invalid leftover math
- Cost totals look wrong after edits: update/delete goes through a full leftover rebuild, so check batch dates and closing leftover quantities first
