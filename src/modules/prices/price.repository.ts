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
import type { ResolvedTarget } from '../locations/location.model';

export interface EnrichedPriceFactRow extends PriceFactWithProvenance {
  outlet_public_id?: string | null;
  outlet_name?: string | null;
  fuel_station_type?: string | null;
  matched_target?: ResolvedTarget;
  has_components?: boolean;
}

export interface SelectedPricePage {
  rows: EnrichedPriceFactRow[];
  total: number;
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
  exists(select 1 from price_component_fact component where component.price_fact_id = p.price_fact_id) as has_components,
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
  coalesce(g.geography_id, og.geography_id) as display_geography_id,
  coalesce(g.country_code, og.country_code, 'IN') as country_code,
  coalesce(g.state_name, og.state_name) as state_name,
  coalesce(g.state_code, og.state_code) as state_code,
  coalesce(g.district_name, og.district_name) as district_name,
  coalesce(g.city_name, og.city_name) as city_name,
  coalesce(g.area_name, og.area_name) as area_name,
  coalesce(g.pincode, og.pincode, o.pincode) as geography_pincode,
  coalesce(g.canonical_label, og.canonical_label, o.city_name || ', ' || o.state_name || ' ' || o.pincode) as canonical_label
`;

function mapRow(r: Record<string, unknown>): EnrichedPriceFactRow {
  const row: EnrichedPriceFactRow = {
    price_fact_id: r.price_fact_id as number,
    public_id: r.public_id as string,
    source_id: r.source_id as number,
    outlet_id: (r.outlet_id as number | null) ?? null,
    geography_id: (r.geography_id as number | null) ?? null,
    fuel_id: r.fuel_id as number,
    applicable_date: toDateOnly(r.applicable_date),
    effective_at: toIsoOrNull(r.effective_at),
    observed_at: toIso(r.observed_at),
    price_value: String(r.price_value),
    currency_code: r.currency_code as string,
    price_kind: r.price_kind as 'retail' | 'breakup_final' | 'tax_exclusive' | 'wholesale_context',
    confidence_score: primitiveString(r.confidence_score),
    raw_document_url: (r.raw_document_url as string | null) ?? null,
    raw_hash: (r.raw_hash as string | null) ?? null,
    attribution_text: (r.attribution_text as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    has_components: Boolean(r.has_components),
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
      r.display_geography_id === null
        ? null
        : {
            geography_id: Number(r.display_geography_id),
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
  if (r.matched_resolution_method) {
    row.matched_target = {
      geography_id: r.matched_geography_id === null ? null : Number(r.matched_geography_id),
      outlet_id: r.matched_outlet_id === null ? null : Number(r.matched_outlet_id),
      resolution_method: r.matched_resolution_method as ResolvedTarget['resolution_method'],
      priority_rank: Number(r.matched_priority_rank),
      direct_from_source: Boolean(r.matched_direct_from_source),
      derived: Boolean(r.matched_derived),
      confidence_modifier: Number(r.matched_confidence_modifier ?? 1),
    };
  }
  return row;
}

function toDateOnly(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function primitiveString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

export async function findSelectedPricePage(input: {
  mode: 'current' | 'history';
  fuelCodes: FuelCode[];
  date?: string;
  from?: string;
  to?: string;
  targets: ResolvedTarget[];
  limit: number;
  offset: number;
}): Promise<SelectedPricePage> {
  if (input.targets.length === 0) return { rows: [], total: 0 };
  const historical = input.mode === 'history';
  const datePredicate = historical
    ? 'p.applicable_date between $3::date and $4::date'
    : 'p.applicable_date = $3::date';
  const partition = historical ? 'f.fuel_code, p.applicable_date' : 'f.fuel_code';
  const limitParam = historical ? '$5' : '$4';
  const offsetParam = historical ? '$6' : '$5';
  const params = historical
    ? [JSON.stringify(input.targets), input.fuelCodes, input.from, input.to, input.limit, input.offset]
    : [JSON.stringify(input.targets), input.fuelCodes, input.date, input.limit, input.offset];
  const sql = `
    with targets as (
      select * from jsonb_to_recordset($1::jsonb) as t(
        geography_id bigint,
        outlet_id bigint,
        resolution_method text,
        priority_rank integer,
        direct_from_source boolean,
        derived boolean,
        confidence_modifier numeric
      )
    ), ranked as (
      select p.price_fact_id,
             t.geography_id as matched_geography_id,
             t.outlet_id as matched_outlet_id,
             t.resolution_method as matched_resolution_method,
             t.priority_rank as matched_priority_rank,
             t.direct_from_source as matched_direct_from_source,
             t.derived as matched_derived,
             t.confidence_modifier as matched_confidence_modifier,
             row_number() over (
               partition by ${partition}
               order by
                 t.priority_rank asc,
                 case s.reliability_tier when 'highest' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
                 case p.price_kind when 'retail' then 1 when 'breakup_final' then 2 when 'tax_exclusive' then 3 else 4 end,
                 p.observed_at desc,
                 coalesce(p.confidence_score, 0) desc,
                 p.public_id asc
             ) as selection_rank
        from price_fact_daily p
        join fuel_dim f on f.fuel_id = p.fuel_id
        join source_catalog s on s.source_id = p.source_id
        left join outlet_dim eligible_outlet on eligible_outlet.outlet_id = p.outlet_id
        join targets t on (
          (p.outlet_id is not null and t.outlet_id = p.outlet_id)
          or
          (p.outlet_id is null and p.geography_id is not null and t.outlet_id is null and t.geography_id = p.geography_id)
        )
       where f.fuel_code = any($2::text[])
         and f.active = true
         and s.active = true
         and s.public_display_enabled = true
         and s.rights_status = 'approved'
         and p.price_kind <> 'wholesale_context'
         and (p.outlet_id is null or eligible_outlet.active = true)
         and ${datePredicate}
    ), selected as (
      select *, count(*) over()::int as selected_total
        from ranked
       where selection_rank = 1
    )
    select ${SELECT_COLS},
           selected.matched_geography_id,
           selected.matched_outlet_id,
           selected.matched_resolution_method,
           selected.matched_priority_rank,
           selected.matched_direct_from_source,
           selected.matched_derived,
           selected.matched_confidence_modifier,
           selected.selected_total
      from selected
      join price_fact_daily p on p.price_fact_id = selected.price_fact_id
      join fuel_dim f on f.fuel_id = p.fuel_id
      join source_catalog s on s.source_id = p.source_id
      left join geography_dim g on g.geography_id = p.geography_id
      left join outlet_dim o on o.outlet_id = p.outlet_id
      left join lateral (
        select candidate.* from geography_dim candidate
         where candidate.pincode = o.pincode
         order by candidate.geography_id
         limit 1
      ) og on true
     order by ${historical ? 'p.applicable_date asc, f.fuel_code asc' : 'selected.matched_priority_rank asc, f.fuel_code asc'}
     limit ${limitParam} offset ${offsetParam}`;
  const result = await query<Record<string, unknown>>(sql, params);
  if (result.rows.length === 0 && input.offset > 0) {
    const firstPage = await findSelectedPricePage({ ...input, limit: 1, offset: 0 });
    return { rows: [], total: firstPage.total };
  }
  return {
    rows: result.rows.map(mapRow),
    total: Number(result.rows[0]?.selected_total ?? 0),
  };
}

export async function findPriceFactByPublicId(publicId: string): Promise<EnrichedPriceFactRow | null> {
  const sql = `
    select ${SELECT_COLS}
      from price_fact_daily p
      join fuel_dim f       on f.fuel_id = p.fuel_id
      join source_catalog s on s.source_id = p.source_id
      left join price_fact_alias a on a.price_fact_id = p.price_fact_id
      left join geography_dim g on g.geography_id = p.geography_id
      left join outlet_dim o    on o.outlet_id    = p.outlet_id
      left join lateral (
        select candidate.* from geography_dim candidate where candidate.pincode = o.pincode order by candidate.geography_id limit 1
      ) og on true
     where (p.public_id = $1 or a.alias_public_id = $1)
       and f.active = true and s.active = true
       and s.public_display_enabled = true and s.rights_status = 'approved'
       and p.price_kind <> 'wholesale_context'
       and (p.outlet_id is null or o.active = true)
     limit 1`;
  const res = await query<Record<string, unknown>>(sql, [publicId]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

export async function findComponentsByPublicPriceId(publicId: string): Promise<PriceComponentRow[]> {
  const sql = `
    select c.*
      from price_component_fact c
      join price_fact_daily p on p.price_fact_id = c.price_fact_id
      join fuel_dim f on f.fuel_id = p.fuel_id
      join source_catalog s on s.source_id = p.source_id
      left join outlet_dim o on o.outlet_id = p.outlet_id
      left join price_fact_alias a on a.price_fact_id = p.price_fact_id
     where (p.public_id = $1 or a.alias_public_id = $1)
       and f.active = true and s.active = true
       and s.public_display_enabled = true and s.rights_status = 'approved'
       and p.price_kind <> 'wholesale_context'
       and (p.outlet_id is null or o.active = true)
     order by c.component_id asc`;
  const res = await query<PriceComponentRow>(sql, [publicId]);
  return res.rows;
}

export async function findComponentsByPublicPriceIds(publicIds: string[]): Promise<Map<string, PriceComponentRow[]>> {
  if (publicIds.length === 0) return new Map();
  const result = await query<PriceComponentRow & { public_id: string }>(
    `select p.public_id, c.* from price_component_fact c
      join price_fact_daily p on p.price_fact_id = c.price_fact_id
     where p.public_id = any($1::text[])
     order by p.public_id, c.component_id`,
    [publicIds],
  );
  const grouped = new Map<string, PriceComponentRow[]>();
  for (const row of result.rows) {
    const rows = grouped.get(row.public_id) ?? [];
    rows.push(row);
    grouped.set(row.public_id, rows);
  }
  return grouped;
}
