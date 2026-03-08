# OpenAPI + Stoplight Elements Setup

This is the exact setup for the new pure PHP backend under `/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api`.

## 1. Install Composer packages

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api
composer install
```

Required packages:

- `php:^8.1`
- `doctrine/annotations:^2.0` for parsing PHP docblock annotations reliably
- `zircote/swagger-php:^4.10` as the OpenAPI 3.0 generator from PHP docblocks

## 2. Use the pure PHP folder structure

```text
backend/api/
  config/
    docs.php
  composer.json
  .env.example
  public/
    index.php
    docs/
      index.php
      .htaccess.example
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
      bootstrap.php
    Controllers/
      AuthController.php
      ProductionSettingController.php
      ProductionBatchController.php
    Docs/
      OpenApi.php
    Services/
      ProductionCostingService.php
    Support/
      ApiException.php
      Auth.php
      Database.php
      Request.php
      Response.php
      Router.php
```

## 3. Configure environment safely

```bash
cp .env.example .env
```

Update:

- `APP_URL`
- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `API_DOCS_USERNAME`
- `API_DOCS_PASSWORD`
- `API_DOCS_IP_ALLOWLIST`
- `API_DOCS_CACHE_SECONDS`

Production-safe rules:

- never commit `.env`
- keep `APP_DEBUG=false` in production
- use a database user with only the permissions this app needs
- use a strong docs username/password if docs are exposed outside localhost

## 4. Create the database and tables

Run the SQL in [schema.sql](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/database/schema.sql).

Suggested database name:

- `amsal_erp`

Optional starter seed:

- [seed_production_basics.sql](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/database/seed_production_basics.sql)
- default admin login:
  `admin@amsal.local` / `ChangeMe123!`
- change that password immediately after first use

Core tables included:

- `users`
- `access_tokens`
- `production_parameters`
- `production_batches`
- `production_batch_items`
- `production_leftover_layers`

## 5. Generate OpenAPI 3.0 from PHP docblocks

Annotations live in [OpenApi.php](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api/src/Docs/OpenApi.php).

Generator entrypoint:

- [generate-openapi.php](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api/scripts/generate-openapi.php)

Run:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api
composer docs:generate
```

Output:

- `public/openapi/v1.json`

## 6. Host Stoplight Elements in `public/docs`

Stoplight Elements is served by [index.php](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api/public/docs/index.php).

URLs:

- UI: `http://localhost/dashboard/amsal-inventory/backend/api/public/docs`
- JSON: `http://localhost/dashboard/amsal-inventory/backend/api/public/api.json?v=v1`

The page points to the generated local JSON file through `/api.json`, applies cache headers, and renders the Stoplight web component in `sidebar` layout.

## 7. Add an automatic rebuild script for docs JSON

Two options are already included.

Composer script:

```bash
composer docs:build
```

Shell script:

```bash
./scripts/rebuild-docs.sh
```

What it does:

1. deletes old generated JSON files
2. rebuilds the fresh OpenAPI JSON

## 8. Annotation examples you asked for

Examples already included in [OpenApi.php](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api/src/Docs/OpenApi.php):

- Auth endpoint with bearer token response:
  `POST /auth/login`
- GET list endpoint with query params:
  `GET /production/settings?parameter_kind=input`
- POST endpoint with JSON body:
  `POST /production/batches`
- Standard error responses:
  `400`, `401`, `422`, `500`

## 9. Secure the docs route

Application-level protection is already implemented in [public/index.php](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api/public/index.php) and [public/docs/index.php](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api/public/docs/index.php).

Option A: Basic auth through `.env`

```env
API_DOCS_USERNAME=docsadmin
API_DOCS_PASSWORD=replace-with-strong-password
```

Option B: IP allowlist through `.env`

```env
API_DOCS_IP_ALLOWLIST=127.0.0.1,::1,192.168.1.10
```

Option C: Apache-level basic auth

Use [`.htaccess.example`](/Applications/XAMPP/xamppfiles/htdocs/dashboard/amsal-inventory/backend/api/public/docs/.htaccess.example) and a `.htpasswd` file.

## 10. Version the docs cleanly

Use one generated file per major version:

- `public/openapi/v1.json`
- `public/openapi/v2.json`

Recommended process:

1. keep backward-compatible changes inside `v1.json`
2. when you introduce breaking changes, duplicate the annotation source into a `V2` docs file
3. add another Stoplight entry page or query switch so `/docs?v=v2` loads `v2.json`

## 11. Common troubleshooting

- `composer install` fails:
  confirm Composer is installed and the machine can reach Packagist
- Stoplight page loads but shows no endpoints:
  run `composer docs:build` and confirm `public/openapi/v1.json` is not empty
- `Class OpenApi\Generator not found`:
  `zircote/swagger-php` is not installed yet
- generator says `Required @OA\Info() not found` even though annotations exist:
  install `doctrine/annotations` and rebuild the docs JSON
- 401 on docs page:
  your docs basic auth credentials do not match `.env`
- 403 on docs page:
  your IP is not in `API_DOCS_IP_ALLOWLIST`
- API endpoints return 401:
  send `Authorization: Bearer <token>`
- production totals are wrong after editing old batches:
  batch dates and closing leftovers drive the full rebuild, so correct those first and save again

## 12. Production endpoints in this first module

Auth:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

Production settings CRUD:

- `GET /api/v1/production/settings`
- `GET /api/v1/production/settings/{id}`
- `POST /api/v1/production/settings`
- `PATCH /api/v1/production/settings/{id}`
- `DELETE /api/v1/production/settings/{id}`

Production batch CRUD:

- `GET /api/v1/production/batches`
- `GET /api/v1/production/batches/{id}`
- `POST /api/v1/production/batches`
- `PATCH /api/v1/production/batches/{id}`
- `DELETE /api/v1/production/batches/{id}`
- `GET /api/v1/production/leftovers`

## 13. Role model for this phase

- `admin`: full access to auth management, production settings, production batches, and docs testing
- `staff`: login exists now for future modules, but production endpoints are restricted to admin in this first backend phase
