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
  findCrawlRunSummary,
  countRecentFailures,
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

// Expected cadence minutes per source type. Tunable, kept conservative.
const CADENCE_MINUTES: Record<string, number> = {
  ppac: 24 * 60,
  omc: 24 * 60,
  cgd: 24 * 60,
  regulator: 7 * 24 * 60,
  aggregator: 12 * 60,
  exchange: 60,
  internal: 60,
};

export class SourceService {
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
      commercial_display: row.source_type !== 'regulator' && (row.commercial_use_allowed ?? false),
    };
  }

  async getSourceHealth(): Promise<SourceHealthRow[]> {
    const sources = await findSources({ active: true, limit: 1000, offset: 0 });
    const out: SourceHealthRow[] = [];
    for (const src of sources) {
      const summary = await findCrawlRunSummary(src.source_id);
      const recentFailures = await countRecentFailures(src.source_id, 3);
      const cadence = CADENCE_MINUTES[src.source_type] ?? 24 * 60;
      const { status, staleness } = classify(src.source_type, summary, recentFailures, cadence);
      out.push({
        source: {
          id: `src_${src.source_key}`,
          name: src.source_name,
          type: src.source_type,
          reliability_tier: src.reliability_tier,
        },
        health: {
          status,
          last_crawl_status: summary?.last_crawl_status ?? null,
          last_successful_crawl_at: summary?.last_successful_crawl_at ?? null,
          minutes_since_success: summary?.minutes_since_success ?? null,
          records_seen_last_run: summary?.records_seen_last_run ?? null,
          records_written_last_run: summary?.records_written_last_run ?? null,
          staleness_level: staleness,
        },
      });
    }
    return out;
  }

  async listCrawlRuns(filters: CrawlRunFilters): Promise<CrawlRunListResult> {
    const runs = await findCrawlRuns(filters);
    const total = await countCrawlRuns(filters);
    return { runs, total };
  }
}

function classify(
  _sourceType: string,
  summary: { minutes_since_success: number | null } | null,
  recentFailures: number,
  cadence: number,
): { status: SourceHealthStatus; staleness: StalenessLevel } {
  const mins = summary?.minutes_since_success ?? null;
  if (mins === null) {
    if (recentFailures >= 3) return { status: 'unhealthy', staleness: 'expired' };
    return { status: 'degraded', staleness: 'stale' };
  }
  if (mins <= cadence) return { status: 'healthy', staleness: 'fresh' };
  if (mins <= 24 * 60) return { status: 'degraded', staleness: 'stale' };
  return { status: 'unhealthy', staleness: 'expired' };
}

// Re-export the row type import for callers outside the module.
import type { SourceCatalogRow } from './sources.model';

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
