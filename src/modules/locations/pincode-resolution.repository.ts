import { query } from '../../db/query';
import type { ResolvedLocationTarget } from './location.model';

type ResolutionRow = {
  geography_id: number | null;
  outlet_id: number | null;
  method: ResolvedLocationTarget['method'];
  priority_rank: number;
  confidence_modifier: string | number;
};

export async function findDirectStationPinTargets(pin: string): Promise<ResolvedLocationTarget[]> {
  const res = await query<ResolutionRow>(
    `select null::bigint as geography_id,
            outlet_id,
            'direct_station_pin'::text as method,
            1 as priority_rank,
            1.00::numeric as confidence_modifier
       from outlet_dim
      where pincode = $1 and active = true
      order by outlet_id asc`,
    [pin],
  );
  return coalesceRows('pin', pin, res.rows);
}

export async function findConfiguredPinTargets(pin: string): Promise<ResolvedLocationTarget[]> {
  const res = await query<ResolutionRow>(
    `select geography_id,
            outlet_id,
            resolution_method as method,
            priority_rank,
            confidence_modifier
       from pincode_resolution
      where pincode = $1 and active = true
      order by priority_rank asc, resolution_id asc`,
    [pin],
  );
  return coalesceRows('pin', pin, res.rows);
}

export async function findCityFallbackTargets(pin: string): Promise<ResolvedLocationTarget[]> {
  const res = await query<ResolutionRow>(
    `select geography_id,
            null::bigint as outlet_id,
            'city_fallback'::text as method,
            4 as priority_rank,
            0.78::numeric as confidence_modifier
       from geography_dim
      where pincode = $1
      order by geography_id asc`,
    [pin],
  );
  return coalesceRows('pin', pin, res.rows);
}

function coalesceRows(
  inputType: ResolvedLocationTarget['inputType'],
  inputValue: string,
  rows: ResolutionRow[],
): ResolvedLocationTarget[] {
  const groups = new Map<string, ResolvedLocationTarget>();
  for (const row of rows) {
    const key = `${row.method}|${row.priority_rank}`;
    const existing = groups.get(key) ?? {
      inputType,
      inputValue,
      geographyIds: [],
      outletIds: [],
      method: row.method,
      priorityRank: row.priority_rank,
      directFromSource: row.method === 'direct_station_pin',
      derived: row.method !== 'direct_station_pin',
      confidenceModifier: Number(row.confidence_modifier),
    };
    const geographyId = row.geography_id === null ? null : Number(row.geography_id);
    const outletId = row.outlet_id === null ? null : Number(row.outlet_id);
    if (geographyId !== null && !existing.geographyIds.includes(geographyId)) {
      existing.geographyIds.push(geographyId);
    }
    if (outletId !== null && !existing.outletIds.includes(outletId)) {
      existing.outletIds.push(outletId);
    }
    groups.set(key, existing);
  }
  return [...groups.values()].filter((t) => t.geographyIds.length > 0 || t.outletIds.length > 0);
}
