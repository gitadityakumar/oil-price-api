import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MemoryCache } from '../../src/core/cache/memory-cache';
import { priceSearchCacheKey, pinResolutionCacheKey, sourceHealthCacheKey } from '../../src/core/cache/cache-key';
import { ConfidenceService } from '../../src/modules/locations/confidence.service';
import { FreshnessService } from '../../src/modules/locations/freshness.service';
import { PincodeResolutionService } from '../../src/modules/locations/pincode-resolution.service';
import { PriceService } from '../../src/modules/prices/price.service';
import { query } from '../../src/db/query';
import { StationService } from '../../src/modules/stations/station.service';

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);

async function ensureSeeded(): Promise<void> {
  const { getPool, closePool } = await import('../../src/db/pool');
  const pool = getPool();
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
  const client = await pool.connect();
  try {
    for (const file of files) {
      await client.query(await readFile(join(process.cwd(), 'migrations', file), 'utf8'));
    }
  } finally {
    client.release();
  }
  await closePool();
}

test('cache keys are stable and canonicalize array ordering', () => {
  const a = priceSearchCacheKey({ selector: { pin: '110001' }, fuels: ['DIESEL', 'PETROL'], date: '2026-07-09', includes: ['source', 'components'] });
  const b = priceSearchCacheKey({ selector: { pin: '110001' }, fuels: ['PETROL', 'DIESEL'], date: '2026-07-09', includes: ['components', 'source'] });
  assert.equal(a, b);
  assert.equal(pinResolutionCacheKey('110001'), 'location:pin:v1:110001');
  assert.equal(sourceHealthCacheKey(), 'source:health:v1:all');
});

test('cache keys separate operation and pagination', () => {
  const base = { selector: { pin: '110001' }, fuels: ['PETROL'], date: '2026-07-09', includes: [] };
  const first = priceSearchCacheKey({ ...base, operation: 'current', limit: 10, offset: 0, generation: 1 });
  const second = priceSearchCacheKey({ ...base, operation: 'current', limit: 10, offset: 10, generation: 1 });
  const history = priceSearchCacheKey({ ...base, operation: 'history', limit: 10, offset: 0, generation: 1 });
  assert.notEqual(first, second);
  assert.notEqual(first, history);
});

test('memory cache evicts least recently used entries at capacity', async () => {
  const cache = new MemoryCache(2);
  await cache.set('a', 1, 60);
  await cache.set('b', 2, 60);
  await cache.get('a');
  await cache.set('c', 3, 60);
  assert.equal(await cache.get('b'), null);
  assert.equal(cache.size(), 2);
});

test('memory cache expires values by ttl', async () => {
  const cache = new MemoryCache();
  await cache.set('k', { ok: true }, 0.01);
  assert.deepEqual(await cache.get('k'), { ok: true });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(await cache.get('k'), null);
});

test('confidence score formula is deterministic and rounded', () => {
  const svc = new ConfidenceService();
  const score = svc.score({
    reliabilityTier: 'highest',
    method: 'city_fallback',
    applicableDate: '2026-07-09',
    observedAt: '2026-07-09T00:47:00.000Z',
    hasComponents: false,
    now: new Date('2026-07-09T02:00:00.000Z'),
  });
  assert.equal(score, 0.74);
});

test('freshness badge formats official same-day observation in IST', () => {
  const badge = new FreshnessService().buildBadge({
    sourceType: 'ppac',
    reliabilityTier: 'highest',
    applicableDate: '2026-07-09',
    effectiveAt: '2026-07-09T00:30:00.000Z',
    observedAt: '2026-07-09T00:47:00.000Z',
    now: new Date('2026-07-09T02:00:00.000Z'),
  });
  assert.match(badge, /Observed from official source today at 06:17 IST/);
});

test('freshness badge marks stale current-date data', () => {
  const badge = new FreshnessService().buildBadge({
    sourceType: 'ppac',
    reliabilityTier: 'highest',
    applicableDate: '2026-07-09',
    effectiveAt: null,
    observedAt: '2026-07-08T00:00:00.000Z',
    now: new Date('2026-07-09T06:00:00.000Z'),
  });
  assert.match(badge, /^Stale: last observed/);
});

test('DB: direct PIN station resolution', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const targets = await new PincodeResolutionService().resolvePin('110001');
  const direct = targets.find((t) => t.method === 'direct_station_pin');
  assert.ok(direct);
  assert.ok(direct!.outletIds.includes(9001));
  assert.equal(direct!.directFromSource, true);
  assert.equal(direct!.derived, false);
});

test('DB: city fallback resolution', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const targets = await new PincodeResolutionService().resolvePin('110001');
  const fallback = targets.find((t) => t.method === 'city_fallback');
  assert.ok(fallback);
  assert.ok(fallback!.geographyIds.includes(1001));
  assert.equal(fallback!.derived, true);
});

test('DB: no PIN resolution returns empty candidates', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const targets = await new PincodeResolutionService().resolvePin('999999');
  assert.deepEqual(targets, []);
});

test('DB: PriceService uses cached response on second identical lookup', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const cache = new MemoryCache();
  const service = new PriceService(cache);
  const input = {
    location: { type: 'pin' as const, pin: '110001' },
    fuels: ['PETROL' as const],
    date: '2026-07-09',
    includes: ['source' as const],
    limit: 50,
    offset: 0,
  };
  const first = await service.getCurrentPrices(input, { requestId: 'r1' });
  const second = await service.getCurrentPrices(input, { requestId: 'r2' });
  assert.equal(first.cache.status, 'MISS');
  assert.equal(second.cache.status, 'HIT');
  assert.deepEqual(second.prices, first.prices);
});

test('DB: source rights changes invalidate prices and station visibility', { skip: !DB_AVAILABLE }, async () => {
  await ensureSeeded();
  const cache = new MemoryCache();
  const prices = new PriceService(cache);
  const input = {
    location: { type: 'pin' as const, pin: '110001' },
    fuels: ['PETROL' as const],
    date: '2026-07-09',
    includes: ['source' as const, 'outlet' as const],
    limit: 50,
    offset: 0,
  };
  const before = await prices.getCurrentPrices(input, { requestId: 'rights-before' });
  assert.ok(before.prices.some((price) => price.source.id === 'src_iocl_retail'));
  try {
    await query("update source_catalog set public_display_enabled = false where source_key = 'iocl_retail'");
    const after = await prices.getCurrentPrices(input, { requestId: 'rights-after' });
    assert.ok(after.prices.every((price) => price.source.id !== 'src_iocl_retail'));
    await assert.rejects(() => new StationService().getStation('outlet_example'), { code: 'NOT_FOUND' });
  } finally {
    await query("update source_catalog set rights_status = 'approved', public_display_enabled = true where source_key = 'iocl_retail'");
    const { closePool } = await import('../../src/db/pool');
    await closePool();
  }
});
