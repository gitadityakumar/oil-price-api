/**
 * Coverage repository — parameterized SQL summary by state/fuel/source_type.
 */

import { query } from '../../db/query';
import type { CoverageRow } from './coverage.model';

const ALLOWED_TYPES = new Set(['ppac', 'omc', 'cgd', 'regulator', 'aggregator', 'exchange', 'internal']);

export function isAllowedSourceType(value: string): boolean {
  return ALLOWED_TYPES.has(value);
}

export async function findCoverage(filters: {
  fuel?: string;
  state?: string;
  source_type?: string;
}): Promise<CoverageRow[]> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let idx = 1;
  const push = (sql: string, value?: unknown): void => {
    conditions.push(sql.replace('?', `$${idx++}`));
    if (value !== undefined) params.push(value);
  };

  if (filters.fuel) push('f.fuel_code = ?', filters.fuel);
  if (filters.state) push('lower(coalesce(g.state_name, o.state_name)) = lower(?)', filters.state);
  if (filters.source_type) push('s.source_type = ?', filters.source_type);

  const sql = `
    select
      coalesce(g.state_name, o.state_name, 'Unknown') as state_name,
      f.fuel_code                       as fuel,
      s.source_type                     as source_type,
      count(distinct p.geography_id)    as geography_count,
      count(distinct p.outlet_id)       as outlet_count,
      max(p.applicable_date)::text      as latest_applicable_date,
      max(p.observed_at)::text          as latest_observed_at
      from price_fact_daily p
      join fuel_dim f       on f.fuel_id = p.fuel_id
       join source_catalog s on s.source_id = p.source_id
       left join geography_dim g on g.geography_id = p.geography_id
       left join outlet_dim o on o.outlet_id = p.outlet_id
     where ${conditions.join(' and ')}
       and (p.geography_id is not null or p.outlet_id is not null)
       and f.active = true
       and s.active = true
       and s.public_display_enabled = true
       and s.rights_status = 'approved'
       and p.price_kind <> 'wholesale_context'
       and (p.outlet_id is null or o.active = true)
      group by coalesce(g.state_name, o.state_name, 'Unknown'), f.fuel_code, s.source_type
      order by state_name asc, f.fuel_code asc, s.source_type asc`;

  const res = await query<Record<string, unknown>>(sql, params);
  return res.rows.map((r) => ({
    state_name: r.state_name as string,
    fuel: r.fuel as string,
    source_type: r.source_type as string,
    geography_count: Number(r.geography_count ?? 0),
    outlet_count: Number(r.outlet_count ?? 0),
    latest_applicable_date: toStringOrNull(r.latest_applicable_date)?.slice(0, 10) ?? null,
    latest_observed_at: r.latest_observed_at === null ? null : new Date(toStringOrNull(r.latest_observed_at) ?? '').toISOString(),
  }));
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) return String(value);
  return null;
}
