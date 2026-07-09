/**
 * Price repository — raw parameterized SQL only. Returns typed enriched rows
 * for the service to rank and map. No HTTP knowledge.
 */

import { query } from '../../db/query';
import type {
  FuelCode,
  PriceFactWithProvenance,
  PriceComponentRow,
} from './prices.model';

export interface EnrichedPriceFactRow extends PriceFactWithProvenance {
  outlet_public_id?: string | null;
  outlet_name?: string | null;
  fuel_station_type?: string | null;
}

const SELECT_COLS = `
  p.price_fact_id,
  p.public_id,
  p.source_id,
  p.outlet_id,
  p.geography_id,
  p.fuel_id,
  p.applicable_date,
  p.effective_at,
  p.observed_at,
  p.price_value,
  p.currency_code,
  p.price_kind,
  p.confidence_score,
  p.raw_document_url,
  p.raw_hash,
  p.attribution_text,
  p.created_at,
  p.updated_at,
  f.fuel_code,
  f.display_name   as fuel_display_name,
  f.retail_unit    as fuel_retail_unit,
  s.source_key,
  s.source_name,
  s.source_type,
  s.operator_name  as source_operator_name,
  s.reliability_tier,
  o.public_id      as outlet_public_id,
  o.outlet_name,
  o.fuel_station_type,
  g.country_code,
  g.state_name,
  g.state_code,
  g.district_name,
  g.city_name,
  g.area_name,
  g.pincode         as geography_pincode,
  g.canonical_label
`;

function mapRow(r: Record<string, unknown>): EnrichedPriceFactRow {
  return {
    price_fact_id: r.price_fact_id as number,
    public_id: r.public_id as string,
    source_id: r.source_id as number,
    outlet_id: (r.outlet_id as number | null) ?? null,
    geography_id: (r.geography_id as number | null) ?? null,
    fuel_id: r.fuel_id as number,
    applicable_date: r.applicable_date as string,
    effective_at: (r.effective_at as string | null) ?? null,
    observed_at: r.observed_at as string,
    price_value: String(r.price_value),
    currency_code: r.currency_code as string,
    price_kind: r.price_kind as 'retail' | 'breakup_final' | 'tax_exclusive' | 'wholesale_context',
    confidence_score: r.confidence_score === null ? null : String(r.confidence_score),
    raw_document_url: (r.raw_document_url as string | null) ?? null,
    raw_hash: (r.raw_hash as string | null) ?? null,
    attribution_text: (r.attribution_text as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    fuel_code: r.fuel_code as FuelCode,
    fuel_display_name: r.fuel_display_name as string,
    fuel_retail_unit: r.fuel_retail_unit as 'LTR' | 'KG' | 'SCM' | 'CYLINDER',
    source_key: r.source_key as string,
    source_name: r.source_name as string,
    source_type: r.source_type as string,
    operator_name: (r.source_operator_name as string | null) ?? null,
    reliability_tier: r.reliability_tier as string | null,
    outlet_public_id: (r.outlet_public_id as string | null) ?? null,
    outlet_name: (r.outlet_name as string | null) ?? null,
    fuel_station_type: (r.fuel_station_type as string | null) ?? null,
    geo:
      r.geography_id === null
        ? null
        : {
            geography_id: r.geography_id as number,
            country_code: (r.country_code ?? 'IN') as string,
            state_name: (r.state_name as string | null) ?? null,
            state_code: (r.state_code as string | null) ?? null,
            district_name: (r.district_name as string | null) ?? null,
            city_name: (r.city_name as string | null) ?? null,
            area_name: (r.area_name as string | null) ?? null,
            pincode: (r.geography_pincode as string | null) ?? null,
            canonical_label: (r.canonical_label as string | null) ?? '',
          },
  };
}

export async function findPriceFactsByTargets(input: {
  fuelCodes: FuelCode[];
  applicableDate: string;
  geographyIds: number[];
  outletIds: number[];
  limit: number;
  offset: number;
}): Promise<EnrichedPriceFactRow[]> {
  const sql = `
    select ${SELECT_COLS}
      from price_fact_daily p
      join fuel_dim f       on f.fuel_id = p.fuel_id
      join source_catalog s on s.source_id = p.source_id
      left join geography_dim g on g.geography_id = p.geography_id
      left join outlet_dim o    on o.outlet_id    = p.outlet_id
     where f.fuel_code = any($1::text[])
       and p.applicable_date = $2
       and (
         (cardinality($3::bigint[]) > 0 and p.geography_id = any($3::bigint[]))
         or
         (cardinality($4::bigint[]) > 0 and p.outlet_id = any($4::bigint[]))
       )
     order by p.observed_at desc
     limit $5 offset $6`;
  const res = await query<Record<string, unknown>>(sql, [
    input.fuelCodes,
    input.applicableDate,
    input.geographyIds,
    input.outletIds,
    input.limit,
    input.offset,
  ]);
  return res.rows.map(mapRow);
}

export async function findHistoricalPriceFacts(input: {
  fuelCode: FuelCode;
  from: string;
  to: string;
  geographyIds: number[];
  outletIds: number[];
  limit: number;
  offset: number;
}): Promise<EnrichedPriceFactRow[]> {
  const sql = `
    select ${SELECT_COLS}
      from price_fact_daily p
      join fuel_dim f       on f.fuel_id = p.fuel_id
      join source_catalog s on s.source_id = p.source_id
      left join geography_dim g on g.geography_id = p.geography_id
      left join outlet_dim o    on o.outlet_id    = p.outlet_id
     where f.fuel_code = $1::text
       and p.applicable_date between $2 and $3
       and (
         (cardinality($4::bigint[]) > 0 and p.geography_id = any($4::bigint[]))
         or
         (cardinality($5::bigint[]) > 0 and p.outlet_id = any($5::bigint[]))
       )
     order by p.applicable_date asc, p.observed_at desc
     limit $6 offset $7`;
  const res = await query<Record<string, unknown>>(sql, [
    input.fuelCode,
    input.from,
    input.to,
    input.geographyIds,
    input.outletIds,
    input.limit,
    input.offset,
  ]);
  return res.rows.map(mapRow);
}

export async function findPriceFactByPublicId(publicId: string): Promise<EnrichedPriceFactRow | null> {
  const sql = `
    select ${SELECT_COLS}
      from price_fact_daily p
      join fuel_dim f       on f.fuel_id = p.fuel_id
      join source_catalog s on s.source_id = p.source_id
      left join geography_dim g on g.geography_id = p.geography_id
      left join outlet_dim o    on o.outlet_id    = p.outlet_id
     where p.public_id = $1
     limit 1`;
  const res = await query<Record<string, unknown>>(sql, [publicId]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

export async function findComponentsByPublicPriceId(publicId: string): Promise<PriceComponentRow[]> {
  const sql = `
    select c.*
      from price_component_fact c
      join price_fact_daily p on p.price_fact_id = c.price_fact_id
     where p.public_id = $1
     order by c.component_id asc`;
  const res = await query<PriceComponentRow>(sql, [publicId]);
  return res.rows;
}

export async function countPriceFactsByTargets(input: {
  fuelCodes: FuelCode[];
  applicableDate: string;
  geographyIds: number[];
  outletIds: number[];
}): Promise<number> {
  const sql = `
    select count(*)::int as c
      from price_fact_daily p
      join fuel_dim f on f.fuel_id = p.fuel_id
     where f.fuel_code = any($1::text[])
       and p.applicable_date = $2
       and (
         (cardinality($3::bigint[]) > 0 and p.geography_id = any($3::bigint[]))
         or
         (cardinality($4::bigint[]) > 0 and p.outlet_id = any($4::bigint[]))
       )`;
  const res = await query<{ c: number }>(sql, [input.fuelCodes, input.applicableDate, input.geographyIds, input.outletIds]);
  return res.rows[0]?.c ?? 0;
}

export async function countHistoricalPriceFacts(input: {
  fuelCode: FuelCode;
  from: string;
  to: string;
  geographyIds: number[];
  outletIds: number[];
}): Promise<number> {
  const sql = `
    select count(*)::int as c
      from price_fact_daily p
      join fuel_dim f on f.fuel_id = p.fuel_id
     where f.fuel_code = $1::text
       and p.applicable_date between $2 and $3
       and (
         (cardinality($4::bigint[]) > 0 and p.geography_id = any($4::bigint[]))
         or
         (cardinality($5::bigint[]) > 0 and p.outlet_id = any($5::bigint[]))
       )`;
  const res = await query<{ c: number }>(sql, [input.fuelCode, input.from, input.to, input.geographyIds, input.outletIds]);
  return res.rows[0]?.c ?? 0;
}