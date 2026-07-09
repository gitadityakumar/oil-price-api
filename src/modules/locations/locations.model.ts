/**
 * Location module domain + persistence types.
 */

export type GeographyRow = {
  geography_id: number;
  country_code: string;
  state_name: string | null;
  state_code: string | null;
  district_name: string | null;
  city_name: string | null;
  area_name: string | null;
  pincode: string | null;
  latitude: string | null;
  longitude: string | null;
  geometry_ref: string | null;
  canonical_label: string;
  created_at: string;
  updated_at: string;
};

export type ResolutionMethod = 'direct_station_pin' | 'nearest_station_geo' | 'tariff_area_mapping' | 'city_fallback';

export type PincodeResolutionRow = {
  resolution_id: number;
  pincode: string;
  geography_id: number | null;
  outlet_id: number | null;
  resolution_method: ResolutionMethod;
  priority_rank: number;
  confidence_modifier: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};