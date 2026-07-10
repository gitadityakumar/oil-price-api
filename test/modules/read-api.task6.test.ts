import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../../src/app';
import { HealthService, SERVICE_VERSION } from '../../src/modules/health/health.service';
import { StationService } from '../../src/modules/stations/station.service';
import { SourceService } from '../../src/modules/sources/source.service';
import { CoverageService } from '../../src/modules/coverage/coverage.service';
import { generateApiKey } from '../../src/modules/auth/api-key-generator';

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
let seededApiKey: string | undefined;

async function ensureSeeded(): Promise<void> {
  const { getPool, closePool } = await import('../../src/db/pool');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const files = [
      '001_initial_schema.sql',
      '002_seed_core_dimensions.sql',
      '003_outlet_public_id.sql',
      '005_seed_reference_sources.sql',
      '006_api_client_scopes.sql',
      '007_integrity_governance_and_jobs.sql',
      '008_seed_source_governance_backfill.sql',
      '009_cache_eligibility_generation.sql',
      '900_fixture_seed.sql',
    ];
    for (const file of files) {
      await client.query(await readFile(join(process.cwd(), 'migrations', file), 'utf8'));
    }
    const generated = generateApiKey({ clientId: 'cli_task6_test' });
    await client.query(
      `insert into api_client (client_id, name, key_hash, status, tier, scopes, rate_limit_per_minute, quota_per_day)
       values ($1, 'Task 6 Test Client', $2, 'active', 'test', array['read:public'], 1000, null)
       on conflict (client_id) do update set key_hash = excluded.key_hash, status = 'active', scopes = excluded.scopes`,
      [generated.client_id, generated.key_hash],
    );
    seededApiKey = generated.api_key;
  } finally {
    client.release();
  }
  await closePool();
}

function fakeReq(method: string, path: string, body?: string, headers: Record<string, string> = {}): IncomingMessage {
  const chunks = body ? [Buffer.from(body)] : [];
  const req = {
    method,
    url: path,
    headers: { 'content-type': body ? 'application/json' : undefined, ...headers },
    on: (ev: string, cb: (arg?: unknown) => void) => {
      if (ev === 'data' && chunks.length) setTimeout(() => cb(chunks.shift()), 0);
      if (ev === 'end') setTimeout(() => cb(), 0);
    },
    destroy: () => {},
  } as unknown as IncomingMessage;
  return req;
}

function fakeRes(): { res: ServerResponse; state: { body: string; statusCode: number; headers: Record<string, string | string[]> } } {
  const state = { body: '', statusCode: 200, headers: {} as Record<string, string | string[]> };
  const res = {
    statusCode: 200,
    hasHeader: (k: string) => Object.prototype.hasOwnProperty.call(state.headers, k.toLowerCase()),
    setHeader: (k: string, v: string | string[]) => { state.headers[k.toLowerCase()] = v; },
    getHeader: (k: string) => state.headers[k.toLowerCase()],
    end: (b?: string | Buffer) => { state.body = b ? b.toString() : ''; },
    destroy: () => {},
    writableEnded: false,
  } as unknown as ServerResponse;
  Object.defineProperty(res, 'statusCode', { get: () => state.statusCode, set: (v: number) => { state.statusCode = v; } });
  return { res, state };
}

async function call(method: string, path: string, headers: Record<string, string> = {}) {
  const app = createApp();
  const req = fakeReq(method, path, undefined, headers);
  const { res, state } = fakeRes();
  await app.handle(req, res);
  return { statusCode: state.statusCode, body: JSON.parse(state.body), headers: state.headers };
}

test('health: public output is minimal and contains no secrets', async () => {
  const health = await new HealthService().getHealth();
  assert.equal(health.status, 'ok');
  assert.equal(health.service, 'indian-fuel-price-api');
  assert.equal(health.version, SERVICE_VERSION);
  const text = JSON.stringify(health);
  assert.ok(!text.includes('DATABASE_URL'));
  assert.ok(!text.includes('postgres://'));
  assert.ok(!text.includes('API_KEY_PEPPER'));
});

test('route /v1/health returns Task 6 health shape', async () => {
  const res = await call('GET', '/v1/health');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.service, 'indian-fuel-price-api');
  assert.equal(res.body.data.version, SERVICE_VERSION);
  assert.equal(res.body.meta.api_version, 'v1');
});

test('stations: filters and pagination against fixture data', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const svc = new StationService();
  const out = await svc.listStations({ pin: '110001', limit: 50, offset: 0 });
  assert.equal(out.total, 1);
  assert.equal(out.stations[0].id, 'outlet_example');
  assert.equal(out.stations[0].location.pincode, '110001');
  assert.ok(out.stations[0].fuels.includes('PETROL'));
});

test('stations: detail by public id', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const station = await new StationService().getStation('outlet_example');
  assert.equal(station.id, 'outlet_example');
  assert.equal(station.operator_name, 'IndianOil');
});

test('route /v1/stations/:id/prices delegates to price lookup', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const res = await call(
    'GET',
    '/v1/stations/outlet_example/prices?date=2026-07-09&fuel=petrol&include=outlet,source',
    { authorization: `Bearer ${seededApiKey}` },
  );
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data.length >= 1);
  assert.equal(res.body.data[0].fuel.code, 'PETROL');
  assert.equal(res.body.data[0].outlet?.id, 'outlet_example');
});

test('sources: filters expose reliability tier and active status', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const out = await new SourceService().listSources({ type: 'omc', active: true, limit: 50, offset: 0 });
  assert.ok(out.total >= 1);
  assert.ok(out.sources.every((s) => s.type === 'omc'));
  assert.ok(out.sources.every((s) => s.active === true));
  assert.ok(out.sources.some((s) => s.reliability_tier === 'highest'));
});

test('sources: detail includes commercial display and terms metadata', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const detail = await new SourceService().getSourceByKey('pngrb_reference');
  assert.equal(detail.id, 'src_pngrb_reference');
  assert.equal(detail.commercial_display, false);
  assert.ok('terms_summary' in detail);
});

test('internal source health: returns per-source rows ready for ops auth', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const rows = await new SourceService().getSourceHealth();
  const ppac = rows.find((r) => r.source.id === 'src_ppac_rsp');
  assert.ok(ppac);
  assert.equal(ppac!.health.last_crawl_status, 'success');
  assert.ok(['healthy', 'degraded', 'unhealthy'].includes(ppac!.health.status));
});

test('crawl runs: filters and newest-first audit rows', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const out = await new SourceService().listCrawlRuns({ source_key: 'ppac_rsp', limit: 1000, offset: 0 });
  assert.ok(out.total >= 1);
  assert.equal(out.runs[0].source_key, 'ppac_rsp');
  assert.equal(out.runs[0].status, 'success');
});

test('coverage: counts against fixture data', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const rows = await new CoverageService().getCoverage({ fuel: 'PETROL', state: 'Delhi', source_type: 'ppac' });
  assert.ok(rows.length >= 1);
  const row = rows.find((r) => r.state_name === 'Delhi' && r.fuel === 'PETROL' && r.source_type === 'ppac');
  assert.ok(row);
  assert.ok(row!.geography_count >= 1);
});
