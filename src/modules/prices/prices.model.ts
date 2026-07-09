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
  fuel_code?: string;
  components?: PriceComponentRow[];
};