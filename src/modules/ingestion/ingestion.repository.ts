import { query } from '../../db/query';
import { withTransaction } from '../../db/transaction';
import type { CapturedArtifact, GeographyInput, NormalizedPriceFact, OutletInput } from './source-adapter';
import type { FinishCrawlRunInput, StartCrawlRunInput, UpsertPriceComponentInput, UpsertPriceFactInput } from './ingestion.model';
import { buildPublicPriceId } from './normalizer';

export async function findSourceByKey(sourceKey: string): Promise<{ source_id: number; source_key: string; source_name: string } | null> {
  const res = await query<{ source_id: number; source_key: string; source_name: string }>(
    'select source_id, source_key, source_name from source_catalog where source_key = $1 limit 1',
    [sourceKey],
  );
  return res.rows[0] ?? null;
}

export async function findFuelId(fuelCode: string): Promise<number> {
  const res = await query<{ fuel_id: number }>('select fuel_id from fuel_dim where fuel_code = $1 limit 1', [fuelCode]);
  return res.rows[0]?.fuel_id ?? 0;
}

export async function createCrawlRun(input: StartCrawlRunInput): Promise<number> {
  const res = await query<{ crawl_run_id: number }>(
    `insert into crawl_run (source_id, started_at, status)
     values ($1, coalesce($2::timestamptz, now()), 'started')
     returning crawl_run_id`,
    [input.source_id, input.started_at ?? null],
  );
  return res.rows[0].crawl_run_id;
}

export async function finishCrawlRun(input: FinishCrawlRunInput): Promise<void> {
  await query(
    `update crawl_run
        set finished_at = coalesce($2::timestamptz, now()),
            status = $3,
            http_status = $4,
            records_seen = $5,
            records_written = $6,
            notes = $7,
            error_code = $8,
            error_message = $9
      where crawl_run_id = $1`,
    [
      input.crawl_run_id,
      input.finished_at ?? null,
      input.status,
      input.http_status ?? null,
      input.records_seen ?? 0,
      input.records_written ?? 0,
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
}): Promise<void> {
  await query(
    `insert into source_artifact (source_id, crawl_run_id, artifact_type, original_url, storage_uri, content_hash, metadata_json)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     on conflict (source_id, content_hash) do update set
       crawl_run_id = excluded.crawl_run_id,
       storage_uri = excluded.storage_uri,
       metadata_json = excluded.metadata_json`,
    [
      input.sourceId,
      input.crawlRunId,
      input.artifact.artifactType,
      input.artifact.originalUrl,
      input.artifact.storageUri,
      input.artifact.contentHash,
      JSON.stringify(input.artifact.metadata ?? {}),
    ],
  );
}

export async function upsertNormalizedFacts(sourceId: number, facts: NormalizedPriceFact[]): Promise<number> {
  let written = 0;
  for (const fact of facts) {
    const fuelId = await findFuelId(fact.fuelCode);
    if (!fuelId) continue;
    const geographyId = fact.geography ? await upsertGeography(fact.geography) : null;
    const outletId = fact.outlet ? await upsertOutlet(sourceId, fact.outlet) : null;
    const publicId = buildPublicPriceId({
      sourceKey: fact.sourceKey,
      fuelCode: fact.fuelCode,
      applicableDate: fact.applicableDate,
      priceKind: fact.priceKind,
      geographyKey: geographyId ? String(geographyId) : undefined,
      outletKey: outletId ? String(outletId) : undefined,
    });
    const priceFactId = await upsertPriceFact({
      public_id: publicId,
      source_id: sourceId,
      outlet_id: outletId,
      geography_id: geographyId,
      fuel_id: fuelId,
      applicable_date: fact.applicableDate,
      effective_at: fact.effectiveAt ?? null,
      observed_at: fact.observedAt,
      price_value: Number(fact.priceValue),
      currency_code: fact.currencyCode,
      price_kind: fact.priceKind,
      confidence_score: null,
      raw_document_url: fact.rawDocumentUrl ?? null,
      raw_hash: fact.rawHash,
      attribution_text: fact.attributionText,
    });
    if (fact.components) {
      for (const component of fact.components) {
        await upsertPriceComponent({
          price_fact_id: priceFactId,
          component_name: component.name,
          component_value: Number(component.value),
          component_unit: component.unit,
        });
      }
    }
    written += 1;
  }
  return written;
}

async function upsertGeography(input: GeographyInput): Promise<number> {
  const existing = await query<{ geography_id: number }>(
    `select geography_id from geography_dim
      where canonical_label = $1 and coalesce(pincode, '') = coalesce($2, '')
      limit 1`,
    [input.canonicalLabel, input.pincode ?? null],
  );
  if (existing.rows[0]) return existing.rows[0].geography_id;
  const created = await query<{ geography_id: number }>(
    `insert into geography_dim (country_code, state_name, state_code, district_name, city_name, area_name, pincode, canonical_label)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
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
  return created.rows[0].geography_id;
}

async function upsertOutlet(sourceId: number, input: OutletInput): Promise<number> {
  const publicId = input.publicId ?? `outlet_${(input.dealerCode ?? input.outletName ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  const existing = await query<{ outlet_id: number }>('select outlet_id from outlet_dim where public_id = $1 limit 1', [publicId]);
  if (existing.rows[0]) return existing.rows[0].outlet_id;
  const created = await query<{ outlet_id: number }>(
    `insert into outlet_dim (public_id, source_id, operator_name, outlet_name, dealer_code, address_text, pincode, city_name, state_name, fuel_station_type, metadata_json, active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, 'unknown'), $11::jsonb, true)
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
  return created.rows[0].outlet_id;
}

async function upsertPriceFact(input: UpsertPriceFactInput): Promise<number> {
  return withTransaction(async ({ query: tx }) => {
    const existing = await tx<{ price_fact_id: number }>(
      `select price_fact_id from price_fact_daily
        where source_id = $1
          and (outlet_id is not distinct from $2)
          and (geography_id is not distinct from $3)
          and fuel_id = $4
          and applicable_date = $5::date
          and price_kind = $6
        limit 1`,
      [input.source_id, input.outlet_id ?? null, input.geography_id ?? null, input.fuel_id, input.applicable_date, input.price_kind],
    );
    if (existing.rows[0]) {
      await tx(
        `update price_fact_daily
            set public_id = $2,
                effective_at = $3,
                observed_at = $4,
                price_value = $5,
                currency_code = $6,
                confidence_score = $7,
                raw_document_url = $8,
                raw_hash = $9,
                attribution_text = $10,
                updated_at = now()
          where price_fact_id = $1`,
        [
          existing.rows[0].price_fact_id,
          input.public_id,
          input.effective_at ?? null,
          input.observed_at,
          input.price_value,
          input.currency_code ?? 'INR',
          input.confidence_score ?? null,
          input.raw_document_url ?? null,
          input.raw_hash ?? null,
          input.attribution_text ?? null,
        ],
      );
      return existing.rows[0].price_fact_id;
    }
    const created = await tx<{ price_fact_id: number }>(
      `insert into price_fact_daily (public_id, source_id, outlet_id, geography_id, fuel_id, applicable_date, effective_at, observed_at, price_value, currency_code, price_kind, confidence_score, raw_document_url, raw_hash, attribution_text)
       values ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning price_fact_id`,
      [
        input.public_id,
        input.source_id,
        input.outlet_id ?? null,
        input.geography_id ?? null,
        input.fuel_id,
        input.applicable_date,
        input.effective_at ?? null,
        input.observed_at,
        input.price_value,
        input.currency_code ?? 'INR',
        input.price_kind,
        input.confidence_score ?? null,
        input.raw_document_url ?? null,
        input.raw_hash ?? null,
        input.attribution_text ?? null,
      ],
    );
    return created.rows[0].price_fact_id;
  });
}

async function upsertPriceComponent(input: UpsertPriceComponentInput): Promise<void> {
  await query(
    `insert into price_component_fact (price_fact_id, component_name, component_value, component_unit)
     values ($1,$2,$3,$4)
     on conflict (price_fact_id, component_name) do update set
       component_value = excluded.component_value,
       component_unit = excluded.component_unit`,
    [input.price_fact_id, input.component_name, input.component_value ?? null, input.component_unit ?? null],
  );
}
