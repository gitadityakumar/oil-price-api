/**
 * Location output schema mappers, including PIN resolution shaping reused by
 * the price schema.
 */

import type { GeographyRow, PincodeResolutionRow, ResolutionMethod } from './locations.model';

export interface LocationSchema {
  country_code: string;
  state_name: string | null;
  state_code: string | null;
  district_name: string | null;
  city_name: string | null;
  area_name: string | null;
  pincode: string | null;
  canonical_label: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PinResolutionSchema {
  pincode: string;
  method: ResolutionMethod;
  priority_rank: number;
  confidence_modifier: number;
  active: boolean;
  geography_id: number | null;
  outlet_id: number | null;
}

/** Shorthand DTO used by services to describe how a PIN was resolved. */
export interface PinResolutionDto {
  pincode: string;
  method: ResolutionMethod;
  priority_rank: number;
  direct_from_source: boolean;
  derived: boolean;
  geography_id: number | null;
  outlet_id: number | null;
}

export function mapGeography(row: GeographyRow): LocationSchema {
  return {
    country_code: row.country_code,
    state_name: row.state_name,
    state_code: row.state_code,
    district_name: row.district_name,
    city_name: row.city_name,
    area_name: row.area_name,
    pincode: row.pincode,
    canonical_label: row.canonical_label,
    latitude: row.latitude !== null ? toNumber(row.latitude) : null,
    longitude: row.longitude !== null ? toNumber(row.longitude) : null,
  };
}

export function mapPincodeResolution(row: PincodeResolutionRow): PinResolutionSchema {
  return {
    pincode: row.pincode,
    method: row.resolution_method,
    priority_rank: row.priority_rank,
    confidence_modifier: toNumber(row.confidence_modifier),
    active: row.active,
    geography_id: row.geography_id,
    outlet_id: row.outlet_id,
  };
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}