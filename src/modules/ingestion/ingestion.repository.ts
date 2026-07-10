import { query } from '../../db/query';
import { withTransaction, type TxQuery } from '../../db/transaction';
import type { CapturedArtifact, GeographyInput, NormalizedPriceFact, OutletInput } from './source-adapter';
import type { ClaimedIngestionJob, FinishCrawlRunInput, IngestionWriteSummary, StartCrawlRunInput, UpsertPriceComponentInput, UpsertPriceFactInput } from './ingestion.model';
import { buildPublicPriceId } from './normalizer';

export async function findSourceByKey(sourceKey: string): Promise<{ source_id: number; source_key: string; source_name: string; ingestion_enabled: boolean; active: boolean } | null> {
  const res = await query<{ source_id: number; source_key: string; source_name: string; ingestion_enabled: boolean; active: boolean }>(
    'select source_id, source_key, source_name, ingestion_enabled, active from source_catalog where source_key = $1 limit 1',
    [sourceKey],
  );
  const row = res.rows[0];
  return row ? { ...row, source_id: Number(row.source_id) } : null;
}

export async function findFuelId(fuelCode: string): Promise<number> {
  const res = await query<{ fuel_id: number }>('select fuel_id from fuel_dim where fuel_code = $1 limit 1', [fuelCode]);
  return Number(res.rows[0]?.fuel_id ?? 0);
}

export async function createCrawlRun(input: StartCrawlRunInput): Promise<number> {
  const res = await query<{ crawl_run_id: number }>(
    `insert into crawl_run (source_id, started_at, status)
     values ($1, coalesce($2::timestamptz, now()), 'started')
     returning crawl_run_id`,
    [input.source_id, input.started_at ?? null],
  );
  return Number(res.rows[0].crawl_run_id);
}

export async function finishCrawlRun(input: FinishCrawlRunInput): Promise<void> {
  await query(
    `update crawl_run
        set finished_at = coalesce($2::timestamptz, now()),
            status = $3,
            http_status = $4,
             records_seen = $5,
             records_written = $6,
             records_rejected = $7,
             notes = $8,
             error_code = $9,
             error_message = $10
      where crawl_run_id = $1`,
    [
      input.crawl_run_id,
      input.finished_at ?? null,
      input.status,
      input.http_status ?? null,
      input.records_seen ?? 0,
      input.records_written ?? 0,
      input.records_rejected ?? 0,
      input.notes ?? null,
      input.error_code ?? null,
      input.error_message ?? null,
    ],
  );
}

export async function recordSourceArtifact(input: {
  sourceId: number;
  crawlRunId: number | null;
  artifact: CapturedArtifact;
}): Promise<number> {
  const result = await query<{ artifact_id: number }>(
    `insert into source_artifact (source_id, crawl_run_id, artifact_type, original_url, storage_uri, content_hash, captured_at, metadata_json)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     on conflict (crawl_run_id, content_hash, (coalesce(original_url, ''))) do update set
       storage_uri = excluded.storage_uri,
       metadata_json = excluded.metadata_json
     returning artifact_id`,
    [
      input.sourceId,
      input.crawlRunId,
      input.artifact.artifactType,
      input.artifact.originalUrl,
      input.artifact.storageUri,
      input.artifact.contentHash,
      input.artifact.capturedAt,
      JSON.stringify(input.artifact.metadata ?? {}),
    ],
  );
  if (result.rows[0]) return Number(result.rows[0].artifact_id);
  const existing = await query<{ artifact_id: number }>(
    `select artifact_id from source_artifact
      where crawl_run_id = $1 and content_hash = $2 and coalesce(original_url, '') = coalesce($3, '')`,
    [input.crawlRunId, input.artifact.contentHash, input.artifact.originalUrl],
  );
  return Number(existing.rows[0].artifact_id);
}

export async function upsertNormalizedFacts(sourceId: number, facts: NormalizedPriceFact[]): Promise<IngestionWriteSummary> {
  return withTransaction(async ({ query: tx }) => {
    let written = 0;
    let rejected = 0;
    for (const fact of facts) {
      if (!isValidFact(fact)) {
        rejected += 1;
        continue;
      }
      const fuelId = await findFuelIdTx(tx, fact.fuelCode);
      if (!fuelId) {
        rejected += 1;
        continue;
      }
      const geographyId = fact.geography ? await upsertGeography(tx, fact.geography) : null;
      const outletId = fact.outlet ? await upsertOutlet(tx, sourceId, fact.outlet) : null;
      const publicId = buildPublicPriceId({
        sourceKey: fact.sourceKey,
        fuelCode: fact.fuelCode,
        applicableDate: fact.applicableDate,
        priceKind: fact.priceKind,
        geographyKey: geographyId ? String(geographyId) : undefined,
        outletKey: outletId ? String(outletId) : undefined,
      });
      const persisted = await upsertPriceFact(tx, {
        public_id: publicId,
        source_id: sourceId,
        outlet_id: outletId,
        geography_id: geographyId,
        fuel_id: fuelId,
        applicable_date: fact.applicableDate,
        effective_at: fact.effectiveAt ?? null,
        observed_at: fact.observedAt,
        price_value: fact.priceValue,
        currency_code: fact.currencyCode,
        price_kind: fact.priceKind,
        confidence_score: null,
        raw_document_url: fact.rawDocumentUrl ?? null,
        raw_hash: fact.rawHash,
        attribution_text: fact.attributionText,
      });
      if (persisted.applied && fact.components !== undefined) {
        await replacePriceComponents(tx, persisted.priceFactId, fact.components);
      }
      if (persisted.applied) {
        await tx(
          'update price_fact_evidence set primary_evidence = false where price_fact_id = $1 and primary_evidence = true',
          [persisted.priceFactId],
        );
      }
      await tx(
        `insert into price_fact_evidence (price_fact_id, artifact_id, parser_version, primary_evidence)
         values ($1, $2, $3, $4)
         on conflict (price_fact_id, artifact_id) do update set parser_version = excluded.parser_version,
           primary_evidence = excluded.primary_evidence`,
        [persisted.priceFactId, fact.evidence.artifactId, fact.evidence.parserVersion, persisted.applied],
      );
      if (persisted.applied) written += 1;
    }
    if (written > 0) {
      await tx(
        `insert into data_generation (namespace, generation) values ('prices', 1)
         on conflict (namespace) do update set generation = data_generation.generation + 1, updated_at = now()`,
      );
    }
    return { inserted_or_updated: written, rejected };
  });
}

async function upsertGeography(tx: TxQuery, input: GeographyInput): Promise<number> {
  const created = await tx<{ geography_id: number }>(
    `insert into geography_dim (country_code, state_name, state_code, district_name, city_name, area_name, pincode, canonical_label)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (lower(canonical_label), (coalesce(pincode, ''))) do update set
       state_name = coalesce(excluded.state_name, geography_dim.state_name),
       state_code = coalesce(excluded.state_code, geography_dim.state_code),
       district_name = coalesce(excluded.district_name, geography_dim.district_name),
       city_name = coalesce(excluded.city_name, geography_dim.city_name),
       area_name = coalesce(excluded.area_name, geography_dim.area_name),
       updated_at = now()
     returning geography_id`,
    [
      input.countryCode ?? 'IN',
      input.stateName ?? null,
      input.stateCode ?? null,
      input.districtName ?? null,
      input.cityName ?? null,
      input.areaName ?? null,
      input.pincode ?? null,
      input.canonicalLabel,
    ],
  );
  return Number(created.rows[0].geography_id);
}

async function upsertOutlet(tx: TxQuery, sourceId: number, input: OutletInput): Promise<number> {
  const publicId = input.publicId ?? `outlet_${sourceId}_${(input.dealerCode ?? input.outletName ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  const created = await tx<{ outlet_id: number }>(
    `insert into outlet_dim (public_id, source_id, operator_name, outlet_name, dealer_code, address_text, pincode, city_name, state_name, fuel_station_type, metadata_json, active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, 'unknown'), $11::jsonb, true)
     on conflict (public_id) do update set
       operator_name = coalesce(excluded.operator_name, outlet_dim.operator_name),
       outlet_name = coalesce(excluded.outlet_name, outlet_dim.outlet_name),
       dealer_code = coalesce(excluded.dealer_code, outlet_dim.dealer_code),
       address_text = coalesce(excluded.address_text, outlet_dim.address_text),
       pincode = coalesce(excluded.pincode, outlet_dim.pincode),
       city_name = coalesce(excluded.city_name, outlet_dim.city_name),
       state_name = coalesce(excluded.state_name, outlet_dim.state_name),
       fuel_station_type = excluded.fuel_station_type,
       metadata_json = excluded.metadata_json,
       active = true,
       updated_at = now()
     returning outlet_id`,
    [
      publicId,
      sourceId,
      input.operatorName ?? null,
      input.outletName ?? null,
      input.dealerCode ?? null,
      input.addressText ?? null,
      input.pincode ?? null,
      input.cityName ?? null,
      input.stateName ?? null,
      input.fuelStationType ?? 'unknown',
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return Number(created.rows[0].outlet_id);
}

async function upsertPriceFact(tx: TxQuery, input: UpsertPriceFactInput): Promise<{ priceFactId: number; applied: boolean }> {
  const conflictTarget = input.outlet_id === null
    ? '(source_id, geography_id, fuel_id, applicable_date, price_kind) where outlet_id is null and geography_id is not null'
    : input.geography_id === null
      ? '(source_id, outlet_id, fuel_id, applicable_date, price_kind) where outlet_id is not null and geography_id is null'
      : '(source_id, outlet_id, geography_id, fuel_id, applicable_date, price_kind) where outlet_id is not null and geography_id is not null';
  const params = [
    input.public_id, input.source_id, input.outlet_id ?? null, input.geography_id ?? null,
    input.fuel_id, input.applicable_date, input.effective_at ?? null, input.observed_at,
    input.price_value, input.currency_code ?? 'INR', input.price_kind,
    input.confidence_score ?? null, input.raw_document_url ?? null, input.raw_hash ?? null,
    input.attribution_text ?? null,
  ];
  const persisted = await tx<{ price_fact_id: number }>(
    `insert into price_fact_daily (public_id, source_id, outlet_id, geography_id, fuel_id, applicable_date, effective_at, observed_at, price_value, currency_code, price_kind, confidence_score, raw_document_url, raw_hash, attribution_text)
     values ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     on conflict ${conflictTarget} do update set
       effective_at = excluded.effective_at,
       observed_at = excluded.observed_at,
       price_value = excluded.price_value,
       currency_code = excluded.currency_code,
       confidence_score = excluded.confidence_score,
       raw_document_url = excluded.raw_document_url,
       raw_hash = excluded.raw_hash,
       attribution_text = excluded.attribution_text,
       updated_at = now()
     where excluded.observed_at >= price_fact_daily.observed_at
     returning price_fact_id`,
    params,
  );
  if (persisted.rows[0]) return { priceFactId: Number(persisted.rows[0].price_fact_id), applied: true };
  const existing = await tx<{ price_fact_id: number }>(
    `select price_fact_id from price_fact_daily
      where source_id = $1 and outlet_id is not distinct from $2 and geography_id is not distinct from $3
        and fuel_id = $4 and applicable_date = $5::date and price_kind = $6`,
    [input.source_id, input.outlet_id ?? null, input.geography_id ?? null, input.fuel_id, input.applicable_date, input.price_kind],
  );
  return { priceFactId: Number(existing.rows[0].price_fact_id), applied: false };
}

async function upsertPriceComponent(tx: TxQuery, input: UpsertPriceComponentInput): Promise<void> {
  await tx(
    `insert into price_component_fact (price_fact_id, component_name, component_value, component_unit)
     values ($1,$2,$3,$4)
     on conflict (price_fact_id, component_name) do update set
       component_value = excluded.component_value,
       component_unit = excluded.component_unit`,
    [input.price_fact_id, input.component_name, input.component_value ?? null, input.component_unit ?? null],
  );
}

async function replacePriceComponents(tx: TxQuery, priceFactId: number, components: NormalizedPriceFact['components']): Promise<void> {
  const supplied = components ?? [];
  for (const component of supplied) {
    await upsertPriceComponent(tx, {
      price_fact_id: priceFactId,
      component_name: component.name,
      component_value: component.value,
      component_unit: component.unit,
    });
  }
  await tx(
    `delete from price_component_fact
      where price_fact_id = $1 and not (component_name = any($2::text[]))`,
    [priceFactId, supplied.map((component) => component.name)],
  );
}

async function findFuelIdTx(tx: TxQuery, fuelCode: string): Promise<number> {
  const result = await tx<{ fuel_id: number }>('select fuel_id from fuel_dim where fuel_code = $1 and active = true', [fuelCode]);
  return Number(result.rows[0]?.fuel_id ?? 0);
}

function isValidFact(fact: NormalizedPriceFact): boolean {
  if (!fact.geography && !fact.outlet) return false;
  if (!isDateOnly(fact.applicableDate) || !isIsoTimestamp(fact.observedAt)) return false;
  if (fact.effectiveAt && !isIsoTimestamp(fact.effectiveAt)) return false;
  if (!isDecimal(fact.priceValue)) return false;
  if (!fact.evidence || !Number.isInteger(fact.evidence.artifactId) || fact.evidence.artifactId <= 0) return false;
  return (fact.components ?? []).every((component) => component.name.trim().length > 0 && isDecimal(component.value));
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function isIsoTimestamp(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function isDecimal(value: string): boolean {
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,4})?$/.test(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1_000_000;
}

export async function enqueueIngestionJob(input: { sourceId: number; crawlRunId: number; reason?: string }): Promise<number> {
  const result = await query<{ ingestion_job_id: number }>(
    `insert into ingestion_job (source_id, crawl_run_id, run_mode, reason)
     values ($1, $2, 'manual', $3)
     returning ingestion_job_id`,
    [input.sourceId, input.crawlRunId, input.reason ?? null],
  );
  return Number(result.rows[0].ingestion_job_id);
}

export async function claimNextIngestionJob(workerId: string): Promise<ClaimedIngestionJob | null> {
  return withTransaction(async ({ query: tx }) => {
    await tx(
      `update ingestion_job set status = 'queued', lease_owner = null, lease_expires_at = null
where status = 'running' and lease_expires_at is not null and lease_expires_at < now()`,
    );
    const result = await tx<ClaimedIngestionJob>(
      `with candidate as (
         select j.ingestion_job_id
           from ingestion_job j
           join source_catalog s on s.source_id = j.source_id
          where j.status = 'queued' and j.available_at <= now()
            and s.active = true and s.ingestion_enabled = true
          order by j.created_at, j.ingestion_job_id
          for update skip locked
          limit 1
       )
       update ingestion_job j
          set status = 'running', attempts = attempts + 1, lease_owner = $1,
              lease_expires_at = now() + interval '10 minutes', updated_at = now()
         from candidate c, source_catalog s
        where j.ingestion_job_id = c.ingestion_job_id and s.source_id = j.source_id
       returning j.ingestion_job_id, j.crawl_run_id, j.source_id, s.source_key, j.reason, j.run_mode, j.attempts`,
      [workerId],
    );
    const row = result.rows[0];
    return row ? {
      ...row,
      ingestion_job_id: Number(row.ingestion_job_id),
      crawl_run_id: Number(row.crawl_run_id),
      source_id: Number(row.source_id),
      attempts: Number(row.attempts),
    } : null;
  });
}

export async function finishIngestionJob(jobId: number, status: 'succeeded' | 'failed', errorCode?: string): Promise<void> {
  await query(
    `update ingestion_job set status = $2, last_error_code = $3, lease_owner = null,
       lease_expires_at = null, updated_at = now() where ingestion_job_id = $1`,
    [jobId, status, errorCode ?? null],
  );
}

export async function listIngestionEnabledSources(): Promise<Array<{ source_id: number; source_key: string; source_type: string }>> {
  const result = await query<{ source_id: number; source_key: string; source_type: string }>(
    `select source_id, source_key, source_type from source_catalog
      where active = true and ingestion_enabled = true order by source_id`,
  );
  return result.rows.map((row) => ({ ...row, source_id: Number(row.source_id) }));
}

export async function enqueueScheduledIngestion(input: { sourceId: number; runKind: string; scheduledFor: string }): Promise<boolean> {
  return withTransaction(async ({ query: tx }) => {
    await tx('select pg_advisory_xact_lock(hashtext($1))', [`ingestion:${input.sourceId}:${input.runKind}:${input.scheduledFor}`]);
    const existing = await tx(
      `select ingestion_job_id from ingestion_job
        where source_id = $1 and run_kind = $2 and scheduled_for = $3::timestamptz`,
      [input.sourceId, input.runKind, input.scheduledFor],
    );
    if (existing.rows.length > 0) return false;
    const crawl = await tx<{ crawl_run_id: number }>(
      `insert into crawl_run (source_id, started_at, status, notes)
       values ($1, now(), 'started', $2) returning crawl_run_id`,
      [input.sourceId, `scheduled ${input.runKind} run for ${input.scheduledFor}`],
    );
    await tx(
      `insert into ingestion_job (source_id, crawl_run_id, run_mode, run_kind, scheduled_for)
       values ($1, $2, 'scheduled', $3, $4::timestamptz)`,
      [input.sourceId, crawl.rows[0].crawl_run_id, input.runKind, input.scheduledFor],
    );
    return true;
  });
}

export async function getPriceDataGeneration(): Promise<number> {
  const result = await query<{ generation: string | number }>("select generation from data_generation where namespace = 'prices'");
  return Number(result.rows[0]?.generation ?? 1);
}
