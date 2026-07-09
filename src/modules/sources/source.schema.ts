/**
 * Source output schema mappers.
 */

import type { SourceCatalogRow, SourceType, ReliabilityTier } from './sources.model';

export interface SourceSchema {
  id: string;
  key: string;
  name: string;
  type: SourceType;
  operator_name: string | null;
  canonical_url: string;
  reliability_tier: ReliabilityTier;
  commercial_use_allowed: boolean | null;
  active: boolean;
  last_successful_crawl_at: string | null;
  last_observed_price_at: string | null;
}

export function mapSource(row: SourceCatalogRow): SourceSchema {
  return {
    id: `src_${row.source_key}`,
    key: row.source_key,
    name: row.source_name,
    type: row.source_type,
    operator_name: row.operator_name,
    canonical_url: row.canonical_url,
    reliability_tier: row.reliability_tier,
    commercial_use_allowed: row.commercial_use_allowed,
    active: row.active,
    last_successful_crawl_at: row.last_successful_crawl_at,
    last_observed_price_at: row.last_observed_price_at,
  };
}