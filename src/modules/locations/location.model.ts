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
}

export interface LocationResolution {
  input: import('./../prices/price.model').LocationInput;
  candidates: ResolvedTarget[];
  warnings: import('./../prices/price.model').Warning[];
}