/**
 * Source read API domain types. SQL rows live in sources.model.ts; HTTP schemas
 * in source.schema.ts.
 */

import type { SourceType, ReliabilityTier, CrawlRunStatus } from './sources.model';
import type { SourceSchema } from './source.schema';

export interface SourceFilters {
  type?: SourceType;
  active?: boolean;
  reliability_tier?: ReliabilityTier;
  limit: number;
  offset: number;
}

export interface SourceListResult {
  sources: SourceSchema[];
  total: number;
}

export type StalenessLevel = 'fresh' | 'stale' | 'expired';
export type SourceHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface SourceHealthRow {
  source: { id: string; name: string; type: SourceType; reliability_tier: ReliabilityTier };
  health: {
    status: SourceHealthStatus;
    last_crawl_status: CrawlRunStatus | null;
    last_successful_crawl_at: string | null;
    minutes_since_success: number | null;
    records_seen_last_run: number | null;
    records_written_last_run: number | null;
    staleness_level: StalenessLevel;
  };
}

export interface CrawlRunFilters {
  source_key?: string;
  status?: CrawlRunStatus;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export interface CrawlRunListItem {
  crawl_run_id: number;
  source_key: string;
  source_name: string;
  source_type: SourceType;
  started_at: string;
  finished_at: string | null;
  status: CrawlRunStatus;
  http_status: number | null;
  records_seen: number;
  records_written: number;
  notes: string | null;
  error_code: string | null;
  error_message: string | null;
}

export interface CrawlRunListResult {
  runs: CrawlRunListItem[];
  total: number;
}