/**
 * Price module domain + persistence types.
 * Repositories return these; services consume them; controllers serialize them.
 * Also hosts the shared fuel_dim types since fuel is consumed by prices.
 */

export type FuelCode = 'PETROL' | 'DIESEL' | 'CNG' | 'PNG' | 'LNG' | 'LPG';
export type RetailUnit = 'LTR' | 'KG' | 'SCM' | 'CYLINDER';

export type FuelRow = {
  fuel_id: number;
  fuel_code: FuelCode;
  display_name: string;
  retail_unit: RetailUnit;
  active: boolean;
};

export type PriceKind = 'retail' | 'breakup_final' | 'tax_exclusive' | 'wholesale_context';

export type PriceFactRow = {
  price_fact_id: string | number;
  public_id: string;
  source_id: number;
  outlet_id: number | null;
  geography_id: number | null;
  fuel_id: number;
  applicable_date: string;
  effective_at: string | null;
  observed_at: string;
  price_value: string;
  currency_code: string;
  price_kind: PriceKind;
  confidence_score: string | null;
  raw_document_url: string | null;
  raw_hash: string | null;
  attribution_text: string | null;
  created_at: string;
  updated_at: string;
};

export type PriceComponentRow = {
  component_id: number;
  price_fact_id: number;
  component_name: string;
  component_value: string | null;
  component_unit: string | null;
  created_at: string;
};

/** Composite price fact as exposed by the read API. */
export type PriceFactWithProvenance = PriceFactRow & {
  source_key?: string;
  fuel_code?: FuelCode;
  fuel_display_name?: string;
  fuel_retail_unit?: RetailUnit;
  components?: PriceComponentRow[];
  outlet_public_id?: string | null;
  geo?: GeographySlices | null;
  pin_resolution?: PinResolutionSlices | null;
  source_name?: string | null;
  source_type?: string | null;
  operator_name?: string | null;
  reliability_tier?: string | null;
};

export type GeographySlices = {
  geography_id: number;
  country_code: string;
  state_name: string | null;
  state_code: string | null;
  district_name: string | null;
  city_name: string | null;
  area_name: string | null;
  pincode: string | null;
  canonical_label: string;
};

export type PinResolutionSlices = {
  pincode: string;
  method: 'direct_station_pin' | 'nearest_station_geo' | 'tariff_area_mapping' | 'city_fallback';
  priority_rank: number;
  direct_from_source: boolean;
  derived: boolean;
  input_type: 'pin' | 'city_state' | 'state' | 'outlet_id';
  input_value: string;
  geography_id: number | null;
  outlet_id: number | null;
};