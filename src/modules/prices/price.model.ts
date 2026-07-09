/**
 * Price read API domain types — lookup inputs, client context, and result
 * shapes consumed by the service and controllers. SQL rows live in
 * prices.model.ts; HTTP schemas in price.schema.ts.
 */

import type { FuelCode, PriceKind } from './prices.model';
import type { ResolutionMethod } from '../locations/locations.model';
import type { PriceSchema, PriceComponentsSchema } from './price.schema';

export type LocationInput =
  | { type: 'pin'; pin: string }
  | { type: 'city_state'; city: string; state: string }
  | { type: 'state'; state: string }
  | { type: 'outlet_id'; outlet_id: string };

export type PriceInclude = 'components' | 'outlet' | 'source';

export interface PriceLookupInput {
  location: LocationInput;
  fuels: FuelCode[];
  date: string;
  includes: PriceInclude[];
  limit: number;
  offset: number;
}

export interface PriceHistoryInput {
  location: LocationInput;
  fuel: FuelCode;
  from: string;
  to: string;
  limit: number;
  offset: number;
}

export interface ClientContext {
  clientId?: string;
  tier?: string;
  requestId: string;
}

export interface PriceLookupResult {
  prices: PriceSchema[];
  total: number;
  warnings: Warning[];
}

export interface PriceHistoryResult {
  prices: PriceSchema[];
  total: number;
  warnings: Warning[];
}

export interface PriceComponentsResult {
  components: PriceComponentsSchema;
}

export interface Warning {
  code: 'NO_PRICE_AVAILABLE' | 'PARTIAL_RESOLUTION' | 'NO_RESOLUTION';
  message: string;
}

/** Selection ranking keys (lower tuple is better). */
export const RESOLUTION_ORDER: ResolutionMethod[] = [
  'direct_station_pin',
  'nearest_station_geo',
  'tariff_area_mapping',
  'city_fallback',
];

export const RELIABILITY_ORDER = ['highest', 'high', 'medium', 'low'] as const;

export const PRICE_KIND_ORDER: PriceKind[] = ['retail', 'breakup_final', 'tax_exclusive'];

export function resolutionRank(method: ResolutionMethod): number {
  const i = RESOLUTION_ORDER.indexOf(method);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

export function reliabilityRank(tier: string | null | undefined): number {
  const i = (RELIABILITY_ORDER as readonly string[]).indexOf(tier ?? '');
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

export function priceKindRank(kind: PriceKind): number {
  const i = PRICE_KIND_ORDER.indexOf(kind);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}