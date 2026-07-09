/**
 * Price output schema mappers. Convert repository rows into the v1 contract
 * JSON shape. Controllers call these instead of hand-writing objects.
 */

import type {
  PriceFactWithProvenance,
  PriceComponentRow,
  FuelRow,
  FuelCode,
  RetailUnit,
} from './prices.model';

export interface FuelSchema {
  code: FuelCode;
  label: string;
  unit: RetailUnit;
}

export interface PriceLocationResolution {
  input_type: 'pin' | 'city_state' | 'state' | 'outlet_id';
  input_value: string;
  method: 'direct_station_pin' | 'nearest_station_geo' | 'tariff_area_mapping' | 'city_fallback';
  priority_rank: number;
  direct_from_source: boolean;
  derived: boolean;
}

export interface PriceLocationSchema {
  country_code: string;
  state_name: string | null;
  state_code: string | null;
  district_name: string | null;
  city_name: string | null;
  area_name: string | null;
  pincode: string | null;
  canonical_label: string;
  resolution?: PriceLocationResolution;
}

export interface PriceSchemaSource {
  id: string;
  name: string;
  type: string | null;
  operator_name: string | null;
  reliability_tier: string | null;
  attribution: string | null;
  document_url: string | null;
}

export interface PriceSchema {
  id: string;
  fuel: FuelSchema;
  price: {
    value: number;
    currency: string;
    unit: RetailUnit;
    kind: string;
  };
  location: PriceLocationSchema | null;
  outlet: { id: string; name: string | null; operator_name: string | null } | null;
  source: PriceSchemaSource;
  provenance: {
    applicable_date: string;
    effective_at: string | null;
    observed_at: string;
    freshness_badge: string;
    confidence_score: number | null;
    raw_hash: string | null;
  };
  links: { components: string };
}

export interface PriceComponentsSchema {
  price_id: string;
  components: Array<{ name: string; value: number | null; unit: string | null }>;
  source: { id: string; name: string | null; document_url: string | null };
  provenance: { observed_at: string; raw_hash: string | null };
}

/** Map a fuel_dim row to the Fuel schema. */
export function mapFuel(row: Pick<FuelRow, 'fuel_code' | 'display_name' | 'retail_unit'>): FuelSchema {
  return { code: row.fuel_code, label: row.display_name, unit: row.retail_unit };
}

/** Map a price fact (with provenance slices) to the Price schema. */
export function mapPrice(row: PriceFactWithProvenance): PriceSchema {
  const fuel: FuelSchema = {
    code: row.fuel_code ?? 'PETROL',
    label: row.fuel_display_name ?? row.fuel_code ?? 'Petrol',
    unit: row.fuel_retail_unit ?? 'LTR',
  };
  const location: PriceLocationSchema | null = row.geo
    ? {
        country_code: row.geo.country_code,
        state_name: row.geo.state_name,
        state_code: row.geo.state_code,
        district_name: row.geo.district_name,
        city_name: row.geo.city_name,
        area_name: row.geo.area_name,
        pincode: row.geo.pincode,
        canonical_label: row.geo.canonical_label,
        resolution: row.pin_resolution
          ? {
              input_type: row.pin_resolution.input_type,
              input_value: row.pin_resolution.input_value,
              method: row.pin_resolution.method,
              priority_rank: row.pin_resolution.priority_rank,
              direct_from_source: row.pin_resolution.direct_from_source,
              derived: row.pin_resolution.derived,
            }
          : undefined,
      }
    : null;

  const outlet = row.outlet_public_id
    ? { id: row.outlet_public_id, name: null, operator_name: row.operator_name ?? null }
    : null;

  const source: PriceSchemaSource = {
    id: `src_${row.source_key ?? 'unknown'}`,
    name: row.source_name ?? '',
    type: row.source_type ?? null,
    operator_name: row.operator_name ?? null,
    reliability_tier: row.reliability_tier ?? null,
    attribution: row.attribution_text ?? null,
    document_url: row.raw_document_url ?? null,
  };

  return {
    id: row.public_id,
    fuel,
    price: {
      value: toNumber(row.price_value),
      currency: row.currency_code,
      unit: fuel.unit,
      kind: row.price_kind,
    },
    location,
    outlet,
    source,
    provenance: {
      applicable_date: row.applicable_date,
      effective_at: row.effective_at,
      observed_at: row.observed_at,
      freshness_badge: computeFreshnessBadge(row.observed_at),
      confidence_score: row.confidence_score !== null ? toNumber(row.confidence_score) : null,
      raw_hash: row.raw_hash,
    },
    links: {
      components: `/v1/prices/${row.public_id}/components`,
    },
  };
}

/** Map a price's component rows to the components schema. */
export function mapPriceComponents(
  price: Pick<PriceFactWithProvenance, 'public_id' | 'observed_at' | 'raw_hash' | 'source_key' | 'source_name' | 'raw_document_url'>,
  components: PriceComponentRow[],
): PriceComponentsSchema {
  return {
    price_id: price.public_id,
    components: components.map((c) => ({
      name: c.component_name,
      value: c.component_value !== null ? toNumber(c.component_value) : null,
      unit: c.component_unit,
    })),
    source: {
      id: `src_${price.source_key ?? 'unknown'}`,
      name: price.source_name ?? null,
      document_url: price.raw_document_url ?? null,
    },
    provenance: {
      observed_at: price.observed_at,
      raw_hash: price.raw_hash,
    },
  };
}

/** Compute a human-readable freshness badge from the observed_at timestamp. */
export function computeFreshnessBadge(observedAt: string): string {
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return 'Observed timestamp unavailable';
  const now = new Date();
  const ageMs = now.getTime() - observed.getTime();
  const ageDays = Math.floor(ageMs / 86_400_000);
  if (ageDays <= 0) {
    return 'Observed from source today';
  }
  if (ageDays === 1) return 'Observed from source 1 day ago';
  if (ageDays <= 7) return `Observed from source ${ageDays} days ago`;
  if (ageDays <= 30) return `Observed from source about ${Math.round(ageDays / 7)} weeks ago`;
  return `Observed from source about ${Math.round(ageDays / 30)} months ago`;
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}