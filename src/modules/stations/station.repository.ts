/**
 * Station repository — raw parameterized SQL only. Returns typed outlet rows
 * enriched with source details and a fuels list (derived from price facts).
 * No HTTP knowledge, no status codes.
 */

import { query } from '../../db/query';
import type { OutletRow } from './stations.model';

export interface StationListItemRow extends Omit<OutletRow, 'fuels'> {
  fuels: string[];
  exact_pin_match: boolean;
}

function mapRow(r: Record<string, unknown>): StationListItemRow {
  const fuelsRaw = Array.isArray(r.fuels) ? (r.fuels as unknown[]) : [];
  const fuels = fuelsRaw.filter((f): f is string => typeof f === 'string');
  return {
    outlet_id: r.outlet_id as number,
    public_id: r.public_id as string,
    source_id: (r.source_id as number | null) ?? null,
    source_key: (r.source_key as string | null) ?? null,
    source_name: (r.source_name as string | null) ?? null,
    operator_name: (r.operator_name as string | null) ?? null,
    outlet_name: (r.outlet_name as string | null) ?? null,
    dealer_code: (r.dealer_code as string | null) ?? null,
    address_text: (r.address_text as string | null) ?? null,
    pincode: (r.pincode as string | null) ?? null,
    city_name: (r.city_name as string | null) ?? null,
    state_name: (r.state_name as string | null) ?? null,
    latitude: (r.latitude as string | null) ?? null,
    longitude: (r.longitude as string | null) ?? null,
    fuel_station_type: r.fuel_station_type as OutletRow['fuel_station_type'],
    metadata_json: (r.metadata_json as Record<string, unknown>) ?? {},
    fuels,
    active: (r.active as boolean) ?? true,
    exact_pin_match: Boolean(r.exact_pin_match),
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

const SELECT_COLS = `
  o.outlet_id,
  o.public_id,
  o.source_id,
  o.operator_name,
  o.outlet_name,
  o.dealer_code,
  o.address_text,
  o.pincode,
  o.city_name,
  o.state_name,
  o.latitude,
  o.longitude,
  o.fuel_station_type,
  o.metadata_json,
  o.active,
  o.created_at,
  o.updated_at,
  s.source_key,
  s.source_name,
  (o.pincode = $<pin>filter) as exact_pin_match,
  coalesce(
    (select array_agg(distinct f.fuel_code)
       from price_fact_daily p
       join fuel_dim f on f.fuel_id = p.fuel_id
       join source_catalog sf on sf.source_id = p.source_id
      where p.outlet_id = o.outlet_id
        and sf.active = true
        and sf.public_display_enabled = true
        and sf.rights_status = 'approved'
        and p.price_kind <> 'wholesale_context'),
    '{}'::text[]
  ) as fuels
`;

/**
 * Find stations by filter. At least one of pin/city/state/operator/fuel is
 * required; the controller enforces that. Results sort by exact PIN match,
 * then active outlets, then operator/name.
 */
export async function findStations(filters: {
  pin?: string;
  city?: string;
  state?: string;
  fuel?: string;
  operator?: string;
  limit: number;
  offset: number;
}): Promise<StationListItemRow[]> {
  const conditions: string[] = [
    'o.active = true',
    "s.active = true and s.public_display_enabled = true and s.rights_status = 'approved'",
  ];
  const params: unknown[] = [];
  let idx = 1;
  const push = (sql: string, value?: unknown): void => {
    conditions.push(sql.replace('?', `$${idx++}`));
    if (value !== undefined) params.push(value);
  };

  if (filters.pin) push('o.pincode = ?', filters.pin);
  if (filters.city) push('lower(o.city_name) = lower(?)', filters.city);
  if (filters.state) push('lower(o.state_name) = lower(?)', filters.state);
  if (filters.operator) push('lower(o.operator_name) = lower(?)', filters.operator);
  if (filters.fuel) {
    push(
      `exists (
        select 1 from price_fact_daily p
        join fuel_dim fd on fd.fuel_id = p.fuel_id
        join source_catalog sf on sf.source_id = p.source_id
        where p.outlet_id = o.outlet_id and fd.fuel_code = ? and fd.active = true
          and sf.active = true and sf.public_display_enabled = true and sf.rights_status = 'approved'
          and p.price_kind <> 'wholesale_context'
      )`,
      filters.fuel,
    );
  }

  const pinFilter = filters.pin ?? '';
  const cols = SELECT_COLS.replace('$<pin>filter', pinFilter === '' ? 'null' : `$${idx++}`);
  if (pinFilter !== '') params.push(pinFilter);

  const sql = `
    select ${cols}
      from outlet_dim o
      left join source_catalog s on s.source_id = o.source_id
     where (${conditions.join(' and ')})
     order by exact_pin_match desc, o.active desc, o.operator_name asc, o.outlet_name asc
     limit $${idx++} offset $${idx++}`;
  params.push(filters.limit, filters.offset);

  const res = await query<Record<string, unknown>>(sql, params);
  return res.rows.map(mapRow);
}

export async function countStations(filters: {
  pin?: string;
  city?: string;
  state?: string;
  fuel?: string;
  operator?: string;
}): Promise<number> {
  const conditions: string[] = [
    'o.active = true',
    "s.active = true and s.public_display_enabled = true and s.rights_status = 'approved'",
  ];
  const params: unknown[] = [];
  let idx = 1;
  const push = (sql: string, value?: unknown): void => {
    conditions.push(sql.replace('?', `$${idx++}`));
    if (value !== undefined) params.push(value);
  };

  if (filters.pin) push('o.pincode = ?', filters.pin);
  if (filters.city) push('lower(o.city_name) = lower(?)', filters.city);
  if (filters.state) push('lower(o.state_name) = lower(?)', filters.state);
  if (filters.operator) push('lower(o.operator_name) = lower(?)', filters.operator);
  if (filters.fuel) {
    push(
      `exists (
        select 1 from price_fact_daily p
        join fuel_dim fd on fd.fuel_id = p.fuel_id
        join source_catalog sf on sf.source_id = p.source_id
        where p.outlet_id = o.outlet_id and fd.fuel_code = ? and fd.active = true
          and sf.active = true and sf.public_display_enabled = true and sf.rights_status = 'approved'
          and p.price_kind <> 'wholesale_context'
      )`,
      filters.fuel,
    );
  }

  const sql = `
    select count(*)::int as c
      from outlet_dim o
      left join source_catalog s on s.source_id = o.source_id
     where (${conditions.join(' and ')})`;
  const res = await query<{ c: number }>(sql, params);
  return res.rows[0]?.c ?? 0;
}

export async function findStationByPublicId(publicId: string): Promise<StationListItemRow | null> {
  const pinFilter = 'null';
  const cols = SELECT_COLS.replace('$<pin>filter', pinFilter);
  const sql = `
    select ${cols}
      from outlet_dim o
      left join source_catalog s on s.source_id = o.source_id
     where o.public_id = $1
       and o.active = true
       and s.active = true and s.public_display_enabled = true and s.rights_status = 'approved'
     limit 1`;
  const res = await query<Record<string, unknown>>(sql, [publicId]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}
