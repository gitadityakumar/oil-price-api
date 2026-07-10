/**
 * Source service — business logic only. No HTTP types.
 * - Lists sources with crawl summaries.
 * - Builds detail view including last success/failed crawl + terms +
 *   commercial display flag (PNGRB reference only).
 * - Computes per-source health per the staleness rules in Task 6.
 */

import {
  findSources,
  countSources,
  findSourceByKey,
  findSourceHealthSummaries,
  findCrawlRuns,
  countCrawlRuns,
} from './source.repository';
import { mapSource } from './source.schema';
import { AppError } from '../../core/errors/app-error';
import type {
  SourceFilters,
  SourceListResult,
  SourceHealthRow,
  CrawlRunFilters,
  CrawlRunListResult,
  SourceHealthStatus,
  StalenessLevel,
} from './source.model';
import type { SourceSchema } from './source.schema';
import { getCache } from '../../core/cache/cache';
import { CACHE_TTL_SECONDS, type Cache } from '../../core/cache/cache.model';
import { sourceHealthCacheKey } from '../../core/cache/cache-key';

export class SourceService {
  constructor(private readonly cache: Cache = getCache()) {}

  async listSources(filters: SourceFilters): Promise<SourceListResult> {
    const rows = await findSources(filters);
    const total = await countSources(filters);
    return { sources: rows.map(mapSource), total };
  }

  async getSourceByKey(key: string): Promise<SourceSchema & {
    last_failed_crawl_at: string | null;
    terms_summary: string | null;
    commercial_display: boolean;
  }> {
    const row = await findSourceByKey(key);
    if (!row) throw new AppError('NOT_FOUND', `Source not found: ${key}`, 404);
    const base = mapSource(row);
    return {
      ...base,
      last_failed_crawl_at: toIsoOrNull((row as SourceCatalogRow & { last_failed_crawl_at?: string | null }).last_failed_crawl_at),
      terms_summary: row.terms_summary,
      // PNGRB reference only; never for commercial display.
      commercial_display: (row.public_display_enabled ?? false) && row.rights_status === 'approved',
    };
  }

  async getSourceHealth(): Promise<SourceHealthRow[]> {
    const key = sourceHealthCacheKey('all');
    const cached = await safeGet<SourceHealthRow[]>(this.cache, key);
    if (cached) return cached;
    const summaries = await findSourceHealthSummaries();
    const out: SourceHealthRow[] = summaries.map((summary) => {
      const { status, staleness } = classify(summary);
      return {
        source: {
          id: `src_${summary.source_key}`,
          name: summary.source_name,
          type: summary.source_type,
          reliability_tier: summary.reliability_tier,
        },
        health: {
          status,
          last_crawl_status: summary.last_crawl_status,
          last_successful_crawl_at: summary.last_successful_crawl_at,
          minutes_since_success: summary.minutes_since_success,
          records_seen_last_run: summary.records_seen_last_run,
          records_written_last_run: summary.records_written_last_run,
          staleness_level: staleness,
        },
      };
    });
    await safeSet(this.cache, key, out, CACHE_TTL_SECONDS.sourceHealth);
    return out;
  }

  async listCrawlRuns(filters: CrawlRunFilters): Promise<CrawlRunListResult> {
    const runs = await findCrawlRuns(filters);
    const total = await countCrawlRuns(filters);
    return { runs, total };
  }
}

function classify(
  summary: {
    last_crawl_status: string | null;
    minutes_since_success: number | null;
    latest_run_age_minutes: number | null;
    recent_failure_count: number;
    expected_cadence_minutes: number;
  },
): { status: SourceHealthStatus; staleness: StalenessLevel } {
  const mins = summary.minutes_since_success;
  if (summary.recent_failure_count >= 3) return { status: 'unhealthy', staleness: 'expired' };
  if (summary.last_crawl_status === 'started' && (summary.latest_run_age_minutes ?? 0) > 60) return { status: 'unhealthy', staleness: 'expired' };
  if (mins === null || mins > 24 * 60) return { status: 'unhealthy', staleness: 'expired' };
  if (summary.last_crawl_status === 'failed') {
    return { status: 'degraded', staleness: mins <= summary.expected_cadence_minutes ? 'fresh' : 'stale' };
  }
  if (mins <= summary.expected_cadence_minutes) return { status: 'healthy', staleness: 'fresh' };
  if (mins <= 24 * 60) return { status: 'degraded', staleness: 'stale' };
  return { status: 'unhealthy', staleness: 'expired' };
}

// Re-export the row type import for callers outside the module.
import type { SourceCatalogRow } from './sources.model';

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  return new Date(String(value)).toISOString();
}

async function safeGet<T>(cache: Cache, key: string): Promise<T | null> {
  try { return await cache.get<T>(key); } catch { return null; }
}

async function safeSet<T>(cache: Cache, key: string, value: T, ttl: number): Promise<void> {
  try { await cache.set(key, value, ttl); } catch { /* best-effort */ }
}
