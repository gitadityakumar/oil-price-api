/**
 * Location resolution repository. Raw SQL only; returns typed rows.
 * Does not import HTTP types or know about status codes.
 */

import { query } from '../../db/query';
import type { LocationInput } from '../prices/price.model';
import type { ResolvedTarget } from './location.model';
import type { GeographyRow, PincodeResolutionRow, ResolutionMethod } from './locations.model';

export interface OutletLookupRow {
  outlet_id: number;
  public_id: string;
  fuel_station_type: string;
  pincode: string | null;
}

/**
 * Resolve a location selector into candidate geography/outlet targets in the
 * order the price service should rank them.
 */
export async function resolveTargets(input: LocationInput): Promise<ResolvedTarget[]> {
  switch (input.type) {
    case 'pin':
      return resolveByPin(input.pin);
    case 'city_state':
      return resolveByCityState(input.city, input.state);
    case 'state':
      return resolveByState(input.state);
    case 'outlet_id':
      return resolveByOutletId(input.outlet_id);
  }
}

async function resolveByPin(pin: string): Promise<ResolvedTarget[]> {
  const out: ResolvedTarget[] = [];

  // 1. pincode_resolution rows ordered by priority_rank.
  const res = await query<PincodeResolutionRow & { public_id: string | null }>(
    `select pr.*, o.public_id
       from pincode_resolution pr
       left join outlet_dim o on o.outlet_id = pr.outlet_id
      where pr.pincode = $1 and pr.active = true
      order by pr.priority_rank asc`,
    [pin],
  );
  for (const r of res.rows) {
    out.push({
      geography_id: r.geography_id,
      outlet_id: r.outlet_id,
      source_public_id: r.public_id,
      resolution_method: r.resolution_method,
      priority_rank: r.priority_rank,
      direct_from_source: r.resolution_method === 'direct_station_pin',
      derived: r.resolution_method !== 'direct_station_pin',
    });
  }

  // 2. Fallback: geography rows matching the pincode directly (city_fallback).
  const geo = await query<GeographyRow>(
    `select * from geography_dim where pincode = $1 order by geography_id asc`,
    [pin],
  );
  const seenGeo = new Set(out.filter((o) => o.geography_id !== null).map((o) => o.geography_id));
  for (const g of geo.rows) {
    if (seenGeo.has(g.geography_id)) continue;
    out.push({
      geography_id: g.geography_id,
      outlet_id: null,
      resolution_method: 'city_fallback',
      priority_rank: 4,
      direct_from_source: false,
      derived: true,
    });
  }

  return out;
}

async function resolveByCityState(city: string, state: string): Promise<ResolvedTarget[]> {
  const res = await query<GeographyRow>(
    `select * from geography_dim
      where lower(city_name) = lower($1) and lower(state_name) = lower($2)
      order by geography_id asc`,
    [city, state],
  );
  return res.rows.map((g) => ({
    geography_id: g.geography_id,
    outlet_id: null,
    resolution_method: 'city_fallback',
    priority_rank: 4,
    direct_from_source: false,
    derived: true,
  }));
}

async function resolveByState(state: string): Promise<ResolvedTarget[]> {
  const res = await query<GeographyRow>(
    `select * from geography_dim where lower(state_name) = lower($1) order by geography_id asc`,
    [state],
  );
  return res.rows.map((g) => ({
    geography_id: g.geography_id,
    outlet_id: null,
    resolution_method: 'city_fallback',
    priority_rank: 4,
    direct_from_source: false,
    derived: true,
  }));
}

async function resolveByOutletId(publicId: string): Promise<ResolvedTarget[]> {
  const res = await query<OutletLookupRow>(
    `select outlet_id, public_id, fuel_station_type, pincode from outlet_dim where public_id = $1 and active = true`,
    [publicId],
  );
  return res.rows.map((o) => ({
    geography_id: null,
    outlet_id: o.outlet_id,
    source_public_id: o.public_id,
    resolution_method: 'direct_station_pin',
    priority_rank: 1,
    direct_from_source: true,
    derived: false,
  }));
}

/** Look up a single geography row by id (used by the price schema mapper). */
export async function findGeographyById(geographyId: number): Promise<GeographyRow | null> {
  const res = await query<GeographyRow>(`select * from geography_dim where geography_id = $1`, [geographyId]);
  return res.rows[0] ?? null;
}

/** Map a pincode_resolution method into the candidate lookup helper. */
export function isResolutionMethod(value: string): value is ResolutionMethod {
  return value === 'direct_station_pin' || value === 'nearest_station_geo' || value === 'tariff_area_mapping' || value === 'city_fallback';
}