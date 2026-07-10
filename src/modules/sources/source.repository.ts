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

export interface SourceHealthSummaryRow {
  source_id: number;
  source_key: string;
  source_name: string;
  source_type: SourceType;
  reliability_tier: ReliabilityTier;
  expected_cadence_minutes: number;
  last_crawl_status: CrawlRunStatus | null;
  last_successful_crawl_at: string | null;
  records_seen_last_run: number | null;
  records_written_last_run: number | null;
  minutes_since_success: number | null;
  latest_run_age_minutes: number | null;
  recent_failure_count: number;
}

export async function findSourceHealthSummaries(): Promise<SourceHealthSummaryRow[]> {
  const result = await query<Record<string, unknown>>(
    `select s.source_id, s.source_key, s.source_name, s.source_type, s.reliability_tier,
            coalesce(s.expected_cadence_minutes,
              case s.source_type when 'exchange' then 60 when 'aggregator' then 720 when 'regulator' then 10080 else 1440 end
            ) as expected_cadence_minutes,
            latest.status as last_crawl_status,
            success.finished_at as last_successful_crawl_at,
            latest.records_seen as records_seen_last_run,
            latest.records_written as records_written_last_run,
            case when success.finished_at is null then null
              else floor(extract(epoch from (now() - success.finished_at)) / 60)::int end as minutes_since_success,
            case when latest.started_at is null then null
              else floor(extract(epoch from (now() - latest.started_at)) / 60)::int end as latest_run_age_minutes,
            coalesce(recent.failure_count, 0)::int as recent_failure_count
       from source_catalog s
       left join lateral (
         select status, started_at, finished_at, records_seen, records_written
           from crawl_run where source_id = s.source_id
          order by started_at desc, crawl_run_id desc limit 1
       ) latest on true
       left join lateral (
         select finished_at from crawl_run
          where source_id = s.source_id and status = 'success'
          order by finished_at desc nulls last, crawl_run_id desc limit 1
       ) success on true
       left join lateral (
         select count(*) filter (where status = 'failed') as failure_count
           from (
             select status from crawl_run where source_id = s.source_id
              order by started_at desc, crawl_run_id desc limit 3
           ) recent_runs
       ) recent on true
      where s.active = true and s.ingestion_enabled = true
      order by s.source_key`,
  );
  return result.rows.map((row) => ({
    source_id: Number(row.source_id),
    source_key: String(row.source_key),
    source_name: String(row.source_name),
    source_type: row.source_type as SourceType,
    reliability_tier: row.reliability_tier as ReliabilityTier,
    expected_cadence_minutes: Number(row.expected_cadence_minutes),
    last_crawl_status: (row.last_crawl_status as CrawlRunStatus | null) ?? null,
    last_successful_crawl_at: row.last_successful_crawl_at ? toIso(row.last_successful_crawl_at) : null,
    records_seen_last_run: row.records_seen_last_run === null ? null : Number(row.records_seen_last_run),
    records_written_last_run: row.records_written_last_run === null ? null : Number(row.records_written_last_run),
    minutes_since_success: row.minutes_since_success === null ? null : Number(row.minutes_since_success),
    latest_run_age_minutes: row.latest_run_age_minutes === null ? null : Number(row.latest_run_age_minutes),
    recent_failure_count: Number(row.recent_failure_count ?? 0),
  }));
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
  if (filters.to) push("cr.started_at < (?::date + interval '1 day')", filters.to);

  const sql = `
    select cr.crawl_run_id, cr.started_at, cr.finished_at, cr.status, cr.http_status,
           cr.records_seen, cr.records_written, cr.notes, cr.error_code, cr.error_message,
           s.source_key, s.source_name, s.source_type
      from crawl_run cr
      join source_catalog s on s.source_id = cr.source_id
     where ${conditions.join(' and ')}
     order by cr.started_at desc, cr.crawl_run_id desc
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
  if (filters.to) push("cr.started_at < (?::date + interval '1 day')", filters.to);

  const sql = `select count(*)::int as c from crawl_run cr join source_catalog s on s.source_id = cr.source_id where ${conditions.join(' and ')}`;
  const res = await query<{ c: number }>(sql, params);
  return res.rows[0]?.c ?? 0;
}

export type { CrawlRunRow };
