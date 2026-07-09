/**
 * Source repository — raw parameterized SQL only. Returns typed source rows
 * enriched with latest crawl summaries. No HTTP knowledge.
 */

import { query } from '../../db/query';
import type { SourceCatalogRow, SourceType, ReliabilityTier, CrawlRunRow, CrawlRunStatus } from './sources.model';
import type { CrawlRunListItem } from './source.model';

export async function findSources(filters: {
  type?: SourceType;
  active?: boolean;
  reliability_tier?: ReliabilityTier;
  limit: number;
  offset: number;
}): Promise<SourceCatalogRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  const push = (sql: string, value?: unknown): void => {
    conditions.push(sql.replace('?', `$${idx++}`));
    if (value !== undefined) params.push(value);
  };

  // Default active=true when the client omits the param entirely.
  const activeValue = filters.active === undefined ? true : filters.active;
  push('active = ?', activeValue);
  if (filters.type) push('source_type = ?', filters.type);
  if (filters.reliability_tier) push('reliability_tier = ?', filters.reliability_tier);

  const sql = `
    select s.*,
      (select max(started_at) from crawl_run cr where cr.source_id = s.source_id and cr.status = 'success') as last_successful_crawl_at,
      (select max(observed_at) from price_fact_daily p where p.source_id = s.source_id) as last_observed_price_at
      from source_catalog s
     where ${conditions.join(' and ')}
     order by s.reliability_tier asc, s.source_key asc
     limit $${idx++} offset $${idx++}`;
  params.push(filters.limit, filters.offset);

  const res = await query<SourceCatalogRow>(sql, params);
  return res.rows;
}

export async function countSources(filters: {
  type?: SourceType;
  active?: boolean;
  reliability_tier?: ReliabilityTier;
}): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  const push = (sql: string, value?: unknown): void => {
    conditions.push(sql.replace('?', `$${idx++}`));
    if (value !== undefined) params.push(value);
  };

  const activeValue = filters.active === undefined ? true : filters.active;
  push('active = ?', activeValue);
  if (filters.type) push('source_type = ?', filters.type);
  if (filters.reliability_tier) push('reliability_tier = ?', filters.reliability_tier);

  const sql = `select count(*)::int as c from source_catalog where ${conditions.join(' and ')}`;
  const res = await query<{ c: number }>(sql, params);
  return res.rows[0]?.c ?? 0;
}

export async function findSourceByKey(key: string): Promise<SourceCatalogRow | null> {
  const sql = `
    select s.*,
      (select max(started_at) from crawl_run cr where cr.source_id = s.source_id and cr.status = 'success') as last_successful_crawl_at,
      (select max(started_at) from crawl_run cr where cr.source_id = s.source_id and cr.status = 'failed')  as last_failed_crawl_at,
      (select max(observed_at) from price_fact_daily p where p.source_id = s.source_id) as last_observed_price_at
      from source_catalog s
     where s.source_key = $1
     limit 1`;
  const res = await query<SourceCatalogRow>(sql, [key]);
  return res.rows[0] ?? null;
}

export async function findCrawlRunSummary(sourceId: number): Promise<{
  last_crawl_status: CrawlRunStatus | null;
  last_successful_crawl_at: string | null;
  records_seen_last_run: number | null;
  records_written_last_run: number | null;
  minutes_since_success: number | null;
} | null> {
  const sql = `
    select
      (select status     from crawl_run where source_id = $1 order by started_at desc limit 1) as last_crawl_status,
      (select started_at from crawl_run where source_id = $1 and status = 'success' order by started_at desc limit 1) as last_successful_crawl_at,
      (select records_seen    from crawl_run where source_id = $1 order by started_at desc limit 1) as records_seen_last_run,
      (select records_written from crawl_run where source_id = $1 order by started_at desc limit 1) as records_written_last_run`;
  const res = await query<{
    last_crawl_status: CrawlRunStatus | null;
    last_successful_crawl_at: string | null;
    records_seen_last_run: number | null;
    records_written_last_run: number | null;
  }>(sql, [sourceId]);
  const row = res.rows[0];
  if (!row) return null;
  const minutesSince = row.last_successful_crawl_at
    ? Math.max(0, Math.round((Date.now() - new Date(row.last_successful_crawl_at).getTime()) / 60_000))
    : null;
  return { ...row, minutes_since_success: minutesSince };
}

export async function countRecentFailures(sourceId: number, lookbackRuns = 3): Promise<number> {
  const sql = `
    select count(*)::int as c
      from (select status from crawl_run where source_id = $1 order by started_at desc limit $2) r
     where status = 'failed'`;
  const res = await query<{ c: number }>(sql, [sourceId, lookbackRuns]);
  return res.rows[0]?.c ?? 0;
}

export async function findCrawlRuns(filters: {
  source_key?: string;
  status?: CrawlRunStatus;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}): Promise<CrawlRunListItem[]> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let idx = 1;
  const push = (sql: string, value?: unknown): void => {
    conditions.push(sql.replace('?', `$${idx++}`));
    if (value !== undefined) params.push(value);
  };

  if (filters.source_key) push('s.source_key = ?', filters.source_key);
  if (filters.status) push('cr.status = ?', filters.status);
  if (filters.from) push('cr.started_at >= ?::timestamptz', filters.from);
  if (filters.to) push('cr.started_at <= ?::timestamptz', filters.to);

  const sql = `
    select cr.crawl_run_id, cr.started_at, cr.finished_at, cr.status, cr.http_status,
           cr.records_seen, cr.records_written, cr.notes, cr.error_code, cr.error_message,
           s.source_key, s.source_name, s.source_type
      from crawl_run cr
      join source_catalog s on s.source_id = cr.source_id
     where ${conditions.join(' and ')}
     order by cr.started_at desc
     limit $${idx++} offset $${idx++}`;
  params.push(filters.limit, filters.offset);

  const res = await query<Record<string, unknown>>(sql, params);
  return res.rows.map((r) => ({
    crawl_run_id: Number(r.crawl_run_id),
    source_key: r.source_key as string,
    source_name: r.source_name as string,
    source_type: r.source_type as CrawlRunListItem['source_type'],
    started_at: toIso(r.started_at),
    finished_at: r.finished_at === null ? null : toIso(r.finished_at),
    status: r.status as CrawlRunListItem['status'],
    http_status: (r.http_status as number | null) ?? null,
    records_seen: Number(r.records_seen ?? 0),
    records_written: Number(r.records_written ?? 0),
    notes: (r.notes as string | null) ?? null,
    error_code: (r.error_code as string | null) ?? null,
    error_message: (r.error_message as string | null) ?? null,
  }));
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

export async function countCrawlRuns(filters: {
  source_key?: string;
  status?: CrawlRunStatus;
  from?: string;
  to?: string;
}): Promise<number> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let idx = 1;
  const push = (sql: string, value?: unknown): void => {
    conditions.push(sql.replace('?', `$${idx++}`));
    if (value !== undefined) params.push(value);
  };

  if (filters.source_key) push('s.source_key = ?', filters.source_key);
  if (filters.status) push('cr.status = ?', filters.status);
  if (filters.from) push('cr.started_at >= ?::timestamptz', filters.from);
  if (filters.to) push('cr.started_at <= ?::timestamptz', filters.to);

  const sql = `select count(*)::int as c from crawl_run cr join source_catalog s on s.source_id = cr.source_id where ${conditions.join(' and ')}`;
  const res = await query<{ c: number }>(sql, params);
  return res.rows[0]?.c ?? 0;
}

export type { CrawlRunRow };
