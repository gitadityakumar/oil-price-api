/**
 * Price read API tests.
 * - DB-backed tests use the fixture seed (migration 003) against a real
 *   postgres container, skipped when DATABASE_URL is unavailable.
 * - Pure tests cover ranking, validation normalization, and MVC boundaries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PriceService, rankAndDedupe } from '../../src/modules/prices/price.service';
import type { EnrichedPriceFactRow } from '../../src/modules/prices/price.repository';
import { parseCurrentPricesQuery, parseHistoryQuery, validatePriceId, todayInKolkata } from '../../src/modules/prices/price.validation';
import { AppError } from '../../src/core/errors/app-error';

function qp(s: string): URLSearchParams { return new URLSearchParams(s); }

// ----------------------------- pure tests --------------------------------

test('parseCurrentPricesQuery: pin selector + default fuels', () => {
  const q = parseCurrentPricesQuery(qp('pin=110001'));
  assert.equal(q.location.type, 'pin');
  assert.equal(q.location.pin, '110001');
  assert.deepEqual(q.fuels, ['PETROL', 'DIESEL', 'CNG', 'PNG']);
  assert.deepEqual(q.includes, []);
  assert.equal(q.limit, 50);
  assert.equal(q.offset, 0);
});

test('parseCurrentPricesQuery: fuel normalization (uppercase, allowlist)', () => {
  const q = parseCurrentPricesQuery(qp('pin=110001&fuel=petrol,cng'));
  assert.deepEqual(q.fuels, ['PETROL', 'CNG']);
});

test('parseCurrentPricesQuery: invalid fuel rejected', () => {
  assert.throws(() => parseCurrentPricesQuery(qp('pin=110001&fuel=kerosene')), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('parseCurrentPricesQuery: invalid pin rejected', () => {
  assert.throws(() => parseCurrentPricesQuery(qp('pin=11001')), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('parseCurrentPricesQuery: missing selector -> VALIDATION_ERROR', () => {
  assert.throws(() => parseCurrentPricesQuery(qp('')), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('parseCurrentPricesQuery: multiple selectors -> VALIDATION_ERROR', () => {
  assert.throws(() => parseCurrentPricesQuery(qp('pin=110001&outlet_id=x')), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('parseCurrentPricesQuery: include allowlist', () => {
  const q = parseCurrentPricesQuery(qp('pin=110001&include=components,source'));
  assert.deepEqual(q.includes, ['components', 'source']);
});

test('parseCurrentPricesQuery: limit clamped to 100', () => {
  const q = parseCurrentPricesQuery(qp('pin=110001&limit=999'));
  assert.equal(q.limit, 100);
});

test('parseHistoryQuery: requires fuel/from/to', () => {
  assert.throws(() => parseHistoryQuery(qp('pin=110001')), (e: AppError) => e.code === 'VALIDATION_ERROR');
  assert.throws(() => parseHistoryQuery(qp('pin=110001&fuel=petrol')), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('parseHistoryQuery: single fuel only', () => {
  assert.throws(() => parseHistoryQuery(qp('pin=110001&fuel=petrol,diesel&from=2026-01-01&to=2026-01-05')), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('parseHistoryQuery: valid range', () => {
  const q = parseHistoryQuery(qp('pin=110001&fuel=petrol&from=2026-01-01&to=2026-01-31'));
  assert.equal(q.fuel, 'PETROL');
  assert.equal(q.from, '2026-01-01');
});

test('validatePriceId: must start with price_', () => {
  assert.equal(validatePriceId('price_example'), 'price_example');
  assert.throws(() => validatePriceId('outlet_x'), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('todayInKolkata: returns YYYY-MM-DD', () => {
  assert.match(todayInKolkata(), /^\d{4}-\d{2}-\d{2}$/);
});

// ------------------------- ranking tests (pure) --------------------------

function makeRow(overrides: Partial<EnrichedPriceFactRow>): EnrichedPriceFactRow {
  return {
    price_fact_id: 1,
    public_id: 'price_a',
    source_id: 1,
    outlet_id: null,
    geography_id: 1001,
    fuel_id: 1,
    applicable_date: '2026-07-09',
    effective_at: null,
    observed_at: '2026-07-09T00:47:00.000Z',
    price_value: '96.72',
    currency_code: 'INR',
    price_kind: 'retail',
    confidence_score: '0.88',
    raw_document_url: null,
    raw_hash: 'sha256:a',
    attribution_text: null,
    created_at: 'x',
    updated_at: 'x',
    fuel_code: 'PETROL',
    fuel_display_name: 'Petrol',
    fuel_retail_unit: 'LTR',
    source_key: 'ppac_rsp',
    source_name: 'PPAC',
    source_type: 'ppac',
    operator_name: null,
    reliability_tier: 'highest',
    outlet_public_id: null,
    geo: {
      geography_id: 1001,
      country_code: 'IN',
      state_name: 'Delhi',
      state_code: 'DL',
      district_name: null,
      city_name: 'Delhi',
      area_name: null,
      pincode: '110001',
      canonical_label: 'Delhi, DL 110001',
    },
    ...overrides,
  } as EnrichedPriceFactRow;
}

test('rankAndDedupe: best by resolution method', () => {
  const rows = [
    makeRow({ public_id: 'p_city', pin_resolution: { pincode: '110001', method: 'city_fallback', priority_rank: 4, direct_from_source: false, derived: true, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null }, confidence_score: '0.95', observed_at: '2026-07-09T00:47:00.000Z' }),
    makeRow({ public_id: 'p_direct', pin_resolution: { pincode: '110001', method: 'direct_station_pin', priority_rank: 1, direct_from_source: true, derived: false, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null }, confidence_score: '0.70', observed_at: '2026-07-09T00:40:00.000Z' }),
  ];
  const out = rankAndDedupe(rows);
  assert.equal(out[0].public_id, 'p_direct');
});

test('rankAndDedupe: then by reliability tier', () => {
  const rows = [
    makeRow({ public_id: 'p_med', reliability_tier: 'medium', pin_resolution: { pincode: '110001', method: 'city_fallback', priority_rank: 4, direct_from_source: false, derived: true, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null } }),
    makeRow({ public_id: 'p_high', reliability_tier: 'high', pin_resolution: { pincode: '110001', method: 'city_fallback', priority_rank: 4, direct_from_source: false, derived: true, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null } }),
  ];
  const out = rankAndDedupe(rows);
  assert.equal(out[0].public_id, 'p_high');
});

test('rankAndDedupe: then by price_kind (retail before breakup_final)', () => {
  const rows = [
    makeRow({ public_id: 'p_breakup', price_kind: 'breakup_final', pin_resolution: { pincode: '110001', method: 'city_fallback', priority_rank: 4, direct_from_source: false, derived: true, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null } }),
    makeRow({ public_id: 'p_retail', price_kind: 'retail', pin_resolution: { pincode: '110001', method: 'city_fallback', priority_rank: 4, direct_from_source: false, derived: true, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null } }),
  ];
  const out = rankAndDedupe(rows);
  assert.equal(out[0].public_id, 'p_retail');
});

test('rankAndDedupe: then by latest observed_at', () => {
  const rows = [
    makeRow({ public_id: 'p_old', observed_at: '2026-07-09T00:30:00.000Z', pin_resolution: { pincode: '110001', method: 'city_fallback', priority_rank: 4, direct_from_source: false, derived: true, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null } }),
    makeRow({ public_id: 'p_new', observed_at: '2026-07-09T00:47:00.000Z', pin_resolution: { pincode: '110001', method: 'city_fallback', priority_rank: 4, direct_from_source: false, derived: true, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null } }),
  ];
  const out = rankAndDedupe(rows);
  assert.equal(out[0].public_id, 'p_new');
});

test('rankAndDedupe: dedupes by fuel+location', () => {
  const rows = [
    makeRow({ public_id: 'p_a', confidence_score: '0.88', pin_resolution: { pincode: '110001', method: 'direct_station_pin', priority_rank: 1, direct_from_source: true, derived: false, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null } }),
    makeRow({ public_id: 'p_b', confidence_score: '0.60', pin_resolution: { pincode: '110001', method: 'city_fallback', priority_rank: 4, direct_from_source: false, derived: true, input_type: 'pin', input_value: '110001', geography_id: 1001, outlet_id: null } }),
  ];
  const out = rankAndDedupe(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].public_id, 'p_a');
});

// ----------------------- MVC boundary check ------------------------------

test('controller does not import repository directly', async () => {
  const controllerText = await readFile(join(process.cwd(), 'src/modules/prices/price.controller.ts'), 'utf8');
  assert.ok(!/from\s+['"].*price\.repository['"]/.test(controllerText), 'controller must not import repository');
  assert.ok(!/from\s+['"].*\/db\/query['"]/.test(controllerText), 'controller must not import db/query');
});

test('service does not import IncomingMessage/ServerResponse', async () => {
  const svcText = await readFile(join(process.cwd(), 'src/modules/prices/price.service.ts'), 'utf8');
  assert.ok(!/IncomingMessage|ServerResponse|HttpContext/.test(svcText), 'service must not import HTTP types');
});

// ----------------------- DB-backed tests (optional) ----------------------

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);

async function ensureSeeded(): Promise<void> {
  const { getPool, closePool } = await import('../../src/db/pool');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const files = [
      '001_initial_schema.sql',
      '002_seed_core_dimensions.sql',
      '003_outlet_public_id.sql',
      '004_fixture_seed.sql',
      '005_seed_reference_sources.sql',
    ];
    for (const file of files) {
      await client.query(await readFile(join(process.cwd(), 'migrations', file), 'utf8'));
    }
  } finally {
    client.release();
  }
  await closePool();
}

test('DB: current prices by pin return enriched schema', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const service = new PriceService();
  const result = await service.getCurrentPrices(
    {
      location: { type: 'pin', pin: '110001' },
      fuels: ['PETROL', 'DIESEL', 'CNG', 'PNG'],
      date: '2026-07-09',
      includes: ['components', 'source'],
      limit: 50,
      offset: 0,
    },
    { requestId: 'test' },
  );
  assert.ok(result.prices.length > 0, 'expected prices');
  const p = result.prices[0];
  assert.ok(p.id.startsWith('price_'), 'id starts with price_');
  assert.equal(p.price.currency, 'INR');
  assert.ok(p.provenance.observed_at, 'observed_at present');
  assert.ok(p.provenance.freshness_badge, 'freshness_badge present');
  // At least one returned price carries PIN resolution details.
  const withPinRes = result.prices.find((x) => x.location?.resolution?.input_type === 'pin');
  assert.ok(withPinRes, 'at least one price has pin resolution');
  assert.equal(withPinRes!.location?.resolution?.method, 'direct_station_pin');
});

test('DB: no-data response for unknown pin', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const service = new PriceService();
  const result = await service.getCurrentPrices(
    { location: { type: 'pin', pin: '999999' }, fuels: ['PETROL'], date: '2026-07-09', includes: [], limit: 50, offset: 0 },
    { requestId: 'test' },
  );
  assert.equal(result.prices.length, 0);
  assert.ok(result.warnings.some((w) => w.code === 'NO_PRICE_AVAILABLE' || w.code === 'NO_RESOLUTION'));
});

test('DB: components endpoint returns components', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const service = new PriceService();
  const out = await service.getPriceComponents('price_example');
  assert.ok(out.components.components.length >= 4);
  assert.equal(out.components.price_id, 'price_example');
});

test('DB: components endpoint 404 for missing price', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const service = new PriceService();
  await assert.rejects(() => service.getPriceComponents('price_missing'), (e: AppError) => e.code === 'NOT_FOUND');
});

test('DB: history endpoint returns rows', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const service = new PriceService();
  const out = await service.getHistoricalPrices(
    { location: { type: 'pin', pin: '110001' }, fuel: 'PETROL', from: '2026-07-08', to: '2026-07-10', limit: 50, offset: 0 },
    { requestId: 'test' },
  );
  assert.ok(out.prices.length > 0);
  assert.equal(out.prices[0].fuel.code, 'PETROL');
});
