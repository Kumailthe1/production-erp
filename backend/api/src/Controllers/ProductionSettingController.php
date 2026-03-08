<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\StateRebuildService;
use App\Support\ApiException;
use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;
use PDO;

class ProductionSettingController
{
    public function __construct(
        private readonly PDO $db,
        private readonly Auth $auth,
        private readonly StateRebuildService $state
    ) {
    }

    public function index(Request $request): never
    {
        $this->auth->requireUser($request);
        $kind = $request->query('parameter_kind');

        $sql = 'SELECT * FROM production_parameters';
        $params = [];
        if ($kind) {
            $sql .= ' WHERE parameter_kind = :parameter_kind';
            $params['parameter_kind'] = $kind;
        }
        $sql .= ' ORDER BY name ASC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::success(['data' => $stmt->fetchAll()]);
    }

    public function show(Request $request, array $params): never
    {
        $this->auth->requireUser($request);
        $stmt = $this->db->prepare('SELECT * FROM production_parameters WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => (int) $params['id']]);
        $setting = $stmt->fetch();
        if (!$setting) {
            throw new ApiException('Production setting not found.', 404);
        }

        Response::success(['data' => $setting]);
    }

    public function store(Request $request): never
    {
        $this->auth->requireRole($request, ['admin']);
        $payload = $this->validate($request->all());
        $payload['code'] = $this->resolveUniqueCode($payload['code'], null);

        $stmt = $this->db->prepare(
            'INSERT INTO production_parameters
            (name, code, parameter_kind, quantity_unit, unit_cost, default_quantity, notes, sort_order, is_active, created_at, updated_at)
            VALUES
            (:name, :code, :parameter_kind, :quantity_unit, :unit_cost, :default_quantity, :notes, :sort_order, :is_active, NOW(), NOW())'
        );
        $stmt->execute($payload);

        Response::success([
            'message' => 'Production setting created successfully.',
            'data' => ['id' => (int) $this->db->lastInsertId()] + $payload,
        ], 201);
    }

    public function update(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $payload = $this->validate($request->all(), true);
        if ($payload === []) {
            throw new ApiException('At least one field is required for update.', 422);
        }

        $exists = $this->db->prepare('SELECT id FROM production_parameters WHERE id = :id LIMIT 1');
        $exists->execute(['id' => (int) $params['id']]);
        if (!$exists->fetch()) {
            throw new ApiException('Production setting not found.', 404);
        }

        if (isset($payload['code']) && $payload['code'] !== '') {
            $payload['code'] = $this->resolveUniqueCode($payload['code'], (int) $params['id']);
        }

        $sets = [];
        foreach (array_keys($payload) as $column) {
            $sets[] = $column . ' = :' . $column;
        }
        $payload['id'] = (int) $params['id'];

        $stmt = $this->db->prepare(
            'UPDATE production_parameters SET ' . implode(', ', $sets) . ', updated_at = NOW() WHERE id = :id'
        );
        $stmt->execute($payload);

        Response::success(['message' => 'Production setting updated successfully.']);
    }

    public function destroy(Request $request, array $params): never
    {
        $this->auth->requireRole($request, ['admin']);
        $parameterId = (int) $params['id'];
        $exists = $this->db->prepare('SELECT id FROM production_parameters WHERE id = :id LIMIT 1');
        $exists->execute(['id' => $parameterId]);
        if (!$exists->fetch()) {
            throw new ApiException('Production setting not found.', 404);
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('DELETE FROM production_parameters WHERE id = :id');
            $stmt->execute(['id' => $parameterId]);
            $this->state->rebuildAll();
            $this->db->commit();
        } catch (\Throwable $throwable) {
            $this->db->rollBack();
            throw $throwable;
        }

        Response::success(['message' => 'Production setting deleted successfully.']);
    }

    private function validate(array $payload, bool $partial = false): array
    {
        $errors = [];
        $allowedKinds = ['input', 'packaging', 'config', 'output'];

        $name = trim((string) ($payload['name'] ?? ''));
        $parameterKind = trim((string) ($payload['parameter_kind'] ?? ''));

        if (!$partial || array_key_exists('name', $payload)) {
            if ($name === '') {
                $errors['name'][] = 'Name is required.';
            }
        }
        if (!$partial || array_key_exists('parameter_kind', $payload)) {
            if (!in_array($parameterKind, $allowedKinds, true)) {
                $errors['parameter_kind'][] = 'Parameter kind is invalid.';
            }
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        $sanitized = [];
        foreach (['name', 'code', 'parameter_kind', 'quantity_unit', 'notes'] as $field) {
            if (array_key_exists($field, $payload)) {
                $sanitized[$field] = trim((string) $payload[$field]);
            }
        }
        foreach (['unit_cost', 'default_quantity'] as $field) {
            if (array_key_exists($field, $payload)) {
                $sanitized[$field] = (float) $payload[$field];
            }
        }
        foreach (['sort_order'] as $field) {
            if (array_key_exists($field, $payload)) {
                $sanitized[$field] = (int) $payload[$field];
            }
        }
        if (array_key_exists('is_active', $payload)) {
            $sanitized['is_active'] = $payload['is_active'] ? 1 : 0;
        }
        if ((!$partial || array_key_exists('code', $payload)) && (($sanitized['code'] ?? '') === '')) {
            $baseName = $sanitized['name'] ?? $name;
            $sanitized['code'] = strtolower((string) preg_replace('/[^a-z0-9]+/i', '_', trim((string) $baseName)));
            $sanitized['code'] = trim($sanitized['code'], '_');
        }
        if (!$partial && !array_key_exists('quantity_unit', $sanitized)) {
            $errors['quantity_unit'][] = 'Quantity unit is required.';
        }
        if ($errors !== []) {
            throw new ApiException('Validation failed.', 422, $errors);
        }

        if (!$partial) {
            $sanitized['notes'] = $sanitized['notes'] ?? '';
            $sanitized['sort_order'] = $sanitized['sort_order'] ?? 0;
            $sanitized['is_active'] = $sanitized['is_active'] ?? 1;
        }

        return $sanitized;
    }

    private function codeExists(string $code, ?int $ignoreId = null): bool
    {
        if ($code === '') {
            return false;
        }

        $sql = 'SELECT id FROM production_parameters WHERE code = :code';
        $params = ['code' => $code];
        if ($ignoreId !== null) {
            $sql .= ' AND id != :id';
            $params['id'] = $ignoreId;
        }
        $sql .= ' LIMIT 1';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return (bool) $stmt->fetch();
    }

    private function resolveUniqueCode(string $baseCode, ?int $ignoreId = null): string
    {
        $candidate = trim($baseCode);
        if ($candidate === '') {
            $candidate = 'parameter';
        }

        if (!$this->codeExists($candidate, $ignoreId)) {
            return $candidate;
        }

        $index = 2;
        while ($this->codeExists($candidate . '_' . $index, $ignoreId)) {
            $index++;
        }

        return $candidate . '_' . $index;
    }
}
