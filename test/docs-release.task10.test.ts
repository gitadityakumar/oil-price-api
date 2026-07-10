import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

const DOCS = [
  'docs/api-contract.md',
  'docs/data-schema.md',
  'docs/openapi.yaml',
  'docs/source-strategy.md',
  'docs/runbook.md',
  'docs/local-development.md',
  'docs/security.md',
  'docs/release-checklist.md',
];

const ENDPOINTS = [
  '/v1/health',
  '/v1/prices',
  '/v1/prices/history',
  '/v1/prices/{id}/components',
  '/v1/stations',
  '/v1/stations/{id}',
  '/v1/stations/{id}/prices',
  '/v1/sources',
  '/v1/sources/{id}',
  '/v1/coverage',
  '/v1/internal/sources/health',
  '/v1/internal/crawl-runs',
  '/v1/internal/ingestion/runs',
];

test('task10 docs exist and include release-critical topics', async () => {
  for (const file of DOCS) {
    const text = await readFile(join(process.cwd(), file), 'utf8');
    assert.ok(text.length > 200, `${file} has substantive content`);
  }

  const api = await readFile(join(process.cwd(), 'docs/api-contract.md'), 'utf8');
  assert.match(api, /Success/i);
  assert.match(api, /Error/i);
  assert.match(api, /Rate limited/i);
  assert.match(api, /Authorization: Bearer/i);

  const runbook = await readFile(join(process.cwd(), 'docs/runbook.md'), 'utf8');
  assert.match(runbook, /Rotate `API_KEY_PEPPER`/);
  assert.match(runbook, /Replay a Failed Crawl/);
});

test('openapi semantically matches the MVP route and version contract', async () => {
  const yaml = await readFile(join(process.cwd(), 'docs/openapi.yaml'), 'utf8');
  const document = parse(yaml) as {
    openapi: string;
    info: { version: string };
    paths: Record<string, Record<string, { operationId?: string; parameters?: Array<Record<string, unknown>> }>>;
    components: { securitySchemes: Record<string, unknown>; parameters: Record<string, { schema?: { maximum?: number } }> };
  };
  const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as { version: string };
  assert.equal(document.openapi, '3.1.0');
  assert.equal(document.info.version, pkg.version);
  const operationIds = new Set<string>();
  for (const endpoint of ENDPOINTS) {
    const path = document.paths[endpoint];
    assert.ok(path, `OpenAPI includes ${endpoint}`);
    for (const operation of Object.values(path)) {
      assert.ok(operation.operationId, `${endpoint} has an operationId`);
      assert.equal(operationIds.has(operation.operationId!), false, `operationId ${operation.operationId} is unique`);
      operationIds.add(operation.operationId!);
    }
  }
  assert.ok(document.components.securitySchemes.bearerApiKey);
  assert.ok(document.components.securitySchemes.clientIdHeader);
  assert.ok(document.components.securitySchemes.apiKeyHeader);
  assert.equal(document.components.parameters.CrawlLimit.schema?.maximum, 1000);

  const historyParameters = document.paths['/v1/prices/history'].get.parameters ?? [];
  const from = historyParameters.find((parameter) => parameter.name === 'from');
  const to = historyParameters.find((parameter) => parameter.name === 'to');
  assert.equal(from?.required, true);
  assert.equal(to?.required, true);
});

test('forbidden framework dependencies and imports are absent', async () => {
  const forbidden = ['express', 'fastify', 'koa', 'hapi', 'nest', 'apollo-server'];
  const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const name of forbidden) {
    assert.equal(deps[name], undefined, `${name} dependency must not be present`);
  }

  const files = await listSourceFiles(join(process.cwd(), 'src'));
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const name of forbidden) {
      assert.equal(text.includes(`from '${name}'`) || text.includes(`require('${name}')`), false, `${file} imports ${name}`);
    }
  }
});

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listSourceFiles(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}
