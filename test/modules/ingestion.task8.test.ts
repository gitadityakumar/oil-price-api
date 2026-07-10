import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listSourceAdapters, getSourceAdapter } from '../../src/modules/ingestion/source-registry';
import { PpacRspAdapter } from '../../src/modules/ingestion/adapters/ppac-rsp.adapter';
import { IglPricesAdapter } from '../../src/modules/ingestion/adapters/igl-prices.adapter';
import { IngestionService } from '../../src/modules/ingestion/ingestion.service';
import { query } from '../../src/db/query';
import { claimNextIngestionJob, createCrawlRun, enqueueIngestionJob, findSourceByKey, finishIngestionJob } from '../../src/modules/ingestion/ingestion.repository';
import { PriceService } from '../../src/modules/prices/price.service';
import { MemoryCache } from '../../src/core/cache/memory-cache';

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);

async function resetAndSeed(): Promise<void> {
  const { getPool, closePool } = await import('../../src/db/pool');
  const pool = getPool();
  const sqlDir = join(process.cwd(), 'migrations');
  const migrationFiles = [
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
    for (const file of migrationFiles) {
      await client.query(await readFile(join(sqlDir, file), 'utf8'));
    }
  } finally {
    client.release();
  }
  await closePool();
}

test('adapter registry lookup finds implemented adapters', () => {
  const keys = listSourceAdapters().map((a) => a.sourceKey);
  assert.ok(keys.includes('ppac_rsp'));
  assert.ok(keys.includes('igl_prices'));
  assert.ok(getSourceAdapter('ppac_rsp') instanceof PpacRspAdapter);
  assert.ok(getSourceAdapter('igl_prices') instanceof IglPricesAdapter);
  assert.equal(getSourceAdapter('unknown_source'), null);
});

test('fixture parser: ppac liquid adapter produces normalized facts', async () => {
  const adapter = new PpacRspAdapter();
  const artifacts = await adapter.fetchArtifacts({ sourceKey: 'ppac_rsp', mode: 'fixture', liveFetch: false, now: new Date() });
  assert.equal(artifacts.length, 1);
  const bytes = artifacts[0].bytes;
  const parsed = await adapter.parseArtifact({
    artifactId: 1,
    sourceKey: 'ppac_rsp',
    artifactType: 'html',
    originalUrl: artifacts[0].originalUrl,
    bytes,
    contentHash: createHash('sha256').update(bytes).digest('hex'),
    capturedAt: '2026-07-09T00:00:00.000Z',
    storageUri: 'fixture://ppac_rsp/current.html',
    metadata: {},
  }, { sourceKey: 'ppac_rsp', mode: 'fixture', liveFetch: false, now: new Date() });
  assert.ok(parsed.length >= 2);
  const normalized = await adapter.normalize(parsed[0], { sourceKey: 'ppac_rsp', mode: 'fixture', liveFetch: false, now: new Date() });
  assert.equal(normalized[0].fuelCode, 'PETROL');
  assert.equal(normalized[0].currencyCode, 'INR');
  assert.equal(normalized[0].priceKind, 'retail');
  assert.ok(normalized[0].components && normalized[0].components.length >= 4);
});

test('fixture parser: igl gas adapter produces normalized facts', async () => {
  const adapter = new IglPricesAdapter();
  const artifacts = await adapter.fetchArtifacts({ sourceKey: 'igl_prices', mode: 'fixture', liveFetch: false, now: new Date() });
  const bytes = artifacts[0].bytes;
  const parsed = await adapter.parseArtifact({
    artifactId: 2,
    sourceKey: 'igl_prices',
    artifactType: 'html',
    originalUrl: artifacts[0].originalUrl,
    bytes,
    contentHash: createHash('sha256').update(bytes).digest('hex'),
    capturedAt: '2026-07-09T00:00:00.000Z',
    storageUri: 'fixture://igl_prices/current.html',
    metadata: {},
  }, { sourceKey: 'igl_prices', mode: 'fixture', liveFetch: false, now: new Date() });
  assert.ok(parsed.some((r) => r.fuelCode === 'CNG'));
  assert.ok(parsed.some((r) => r.fuelCode === 'PNG'));
  const normalized = await adapter.normalize(parsed[0], { sourceKey: 'igl_prices', mode: 'fixture', liveFetch: false, now: new Date() });
  assert.equal(normalized[0].currencyCode, 'INR');
});

test('artifact hash stability for identical bytes', async () => {
  const bytes = await readFile(join(process.cwd(), 'fixtures', 'ingestion', 'ppac_rsp', 'current.html'));
  const a = createHash('sha256').update(bytes).digest('hex');
  const b = createHash('sha256').update(bytes).digest('hex');
  assert.equal(a, b);
});

test('DB: crawl run transitions to success and records artifacts', { skip: !DB_AVAILABLE }, async () => {
  await resetAndSeed();
  const svc = new IngestionService();
  const result = await svc.runFixture('ppac_rsp');
  assert.ok(result.records_seen > 0);
  assert.ok(result.records_written > 0);
  const run = await query<{ status: string; records_seen: number; records_written: number }>(
    'select status, records_seen, records_written from crawl_run where crawl_run_id = $1',
    [result.crawl_run_id],
  );
  assert.equal(run.rows[0].status, 'success');
  const artifacts = await query<{ c: number }>('select count(*)::int as c from source_artifact where crawl_run_id = $1', [result.crawl_run_id]);
  assert.ok(artifacts.rows[0].c >= 1);
  const evidence = await query<{ c: number }>(
    `select count(*)::int as c from price_fact_evidence e
      join price_fact_daily p on p.price_fact_id = e.price_fact_id
      join source_artifact a on a.artifact_id = e.artifact_id
     where a.crawl_run_id = $1 and p.raw_hash = a.content_hash and p.observed_at = a.captured_at`,
    [result.crawl_run_id],
  );
  assert.equal(evidence.rows[0].c, result.records_written);
});

test('DB: idempotent price upsert for fixture ingestion', { skip: !DB_AVAILABLE }, async () => {
  await resetAndSeed();
  const svc = new IngestionService();
  await svc.runFixture('ppac_rsp');
  const before = await query<{ c: number }>("select count(*)::int as c from price_fact_daily where source_id = (select source_id from source_catalog where source_key = 'ppac_rsp')", []);
  await svc.runFixture('ppac_rsp');
  const after = await query<{ c: number }>("select count(*)::int as c from price_fact_daily where source_id = (select source_id from source_catalog where source_key = 'ppac_rsp')", []);
  assert.equal(after.rows[0].c, before.rows[0].c);
  const multiplePrimary = await query<{ c: number }>(
    `select count(*)::int as c from (
       select price_fact_id from price_fact_evidence
        where primary_evidence = true group by price_fact_id having count(*) > 1
     ) invalid_primary_groups`,
  );
  assert.equal(multiplePrimary.rows[0].c, 0);
});

test('DB: disabled fixture adapters are rejected before creating a crawl', { skip: !DB_AVAILABLE }, async () => {
  await resetAndSeed();
  const svc = new IngestionService();
  const before = await query<{ c: number }>(
    `select count(*)::int as c from crawl_run cr join source_catalog s on s.source_id = cr.source_id where s.source_key = 'iocl_retail'`,
  );
  await assert.rejects(() => svc.runFixture('iocl_retail'));
  const after = await query<{ c: number }>(
    `select count(*)::int as c from crawl_run cr join source_catalog s on s.source_id = cr.source_id where s.source_key = 'iocl_retail'`,
  );
  assert.equal(after.rows[0].c, before.rows[0].c);
});

test('DB: concurrent fixture replay preserves one fact per natural key', { skip: !DB_AVAILABLE }, async () => {
  await resetAndSeed();
  const svc = new IngestionService();
  await Promise.all([svc.runFixture('ppac_rsp'), svc.runFixture('ppac_rsp')]);
  const duplicates = await query<{ c: number }>(
    `select count(*)::int as c from (
       select source_id, outlet_id, geography_id, fuel_id, applicable_date, price_kind
       from price_fact_daily group by 1,2,3,4,5,6 having count(*) > 1
     ) duplicate_groups`,
  );
  assert.equal(duplicates.rows[0].c, 0);
});

test('DB: expired ingestion leases are reclaimed', { skip: !DB_AVAILABLE }, async () => {
  await resetAndSeed();
  const source = await findSourceByKey('ppac_rsp');
  assert.ok(source);
  const crawlRunId = await createCrawlRun({ source_id: source.source_id });
  const jobId = await enqueueIngestionJob({ sourceId: source.source_id, crawlRunId, reason: 'lease test' });
  await query(
    "update ingestion_job set status = 'running', lease_owner = 'dead-worker', lease_expires_at = now() - interval '1 minute' where ingestion_job_id = $1",
    [jobId],
  );
  const claimed = await claimNextIngestionJob('replacement-worker');
  assert.equal(claimed?.ingestion_job_id, jobId);
  await finishIngestionJob(jobId, 'failed', 'TEST_COMPLETE');
  await query('delete from ingestion_job where ingestion_job_id = $1', [jobId]);
  await query('delete from crawl_run where crawl_run_id = $1', [crawlRunId]);
});

test('DB: PNGRB reference rows are excluded from retail selection', { skip: !DB_AVAILABLE }, async () => {
  await resetAndSeed();
  const source = await query<{ source_id: number }>("select source_id from source_catalog where source_key = 'pngrb_reference'", []);
  const fuel = await query<{ fuel_id: number }>("select fuel_id from fuel_dim where fuel_code = 'PETROL'", []);
  await query(
    `delete from price_fact_daily where source_id = $1 and geography_id = 1001 and fuel_id = $2
      and applicable_date = '2026-07-09' and price_kind = 'retail'`,
    [source.rows[0].source_id, fuel.rows[0].fuel_id],
  );
  const publicId = `price_pngrb_test_${Date.now()}`;
  await query(
    `insert into price_fact_daily (public_id, source_id, geography_id, fuel_id, applicable_date, observed_at, price_value, currency_code, price_kind, raw_hash, attribution_text)
     values ($1, $2, 1001, $3, '2026-07-09', '2026-07-09T01:00:00.000Z', 98.99, 'INR', 'retail', 'sha256:pngrb', 'reference only')`,
    [publicId, source.rows[0].source_id, fuel.rows[0].fuel_id],
  );
  const prices = await new PriceService(new MemoryCache()).getCurrentPrices(
    { location: { type: 'pin', pin: '110001' }, fuels: ['PETROL'], date: '2026-07-09', includes: [], limit: 50, offset: 0 },
    { requestId: 't' },
  );
  assert.ok(prices.prices.every((p) => p.source.id !== 'src_pngrb_reference'));
});
