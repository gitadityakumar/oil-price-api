/**
 * Location resolution domain types used by the price service.
 */

import type { ResolutionMethod } from './locations.model';

/** A candidate target produced by resolving a location selector. */
export interface ResolvedTarget {
  geography_id: number | null;
  outlet_id: number | null;
  source_public_id?: string | null;
  resolution_method: ResolutionMethod;
  priority_rank: number;
  direct_from_source: boolean;
  derived: boolean;
  confidence_modifier: number;
}

export interface LocationResolution {
  input: import('./../prices/price.model').LocationInput;
  candidates: ResolvedTarget[];
  warnings: import('./../prices/price.model').Warning[];
}

export interface LocationSelector {
  pin?: string;
  city?: string;
  state?: string;
  outletId?: string;
}

export interface ResolvedLocationTarget {
  inputType: 'pin' | 'city' | 'state' | 'outlet_id';
  inputValue: string;
  geographyIds: number[];
  outletIds: number[];
  method: 'direct_station_pin' | 'nearest_station_geo' | 'tariff_area_mapping' | 'city_fallback';
  priorityRank: number;
  directFromSource: boolean;
  derived: boolean;
  confidenceModifier: number;
}
