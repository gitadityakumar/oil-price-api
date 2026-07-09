/**
 * Source controller — HTTP only. Parses query/path, validates, calls
 * SourceService, writes the standardized envelope. No SQL.
 */

import type { HttpContext } from '../../core/http/context';
import { ok, okPaginated, error } from '../../core/http/response';
import { AppError } from '../../core/errors/app-error';
import { buildPagination } from '../../core/http/pagination';
import { resolvePagination } from '../../core/validation/query';
import { SourceService } from './source.service';
import type { SourceType, ReliabilityTier, CrawlRunStatus } from './sources.model';

const ALLOWED_TYPES = new Set(['ppac', 'omc', 'cgd', 'regulator', 'aggregator', 'exchange']);
const ALLOWED_TIERS = new Set(['highest', 'high', 'medium', 'low']);
const ALLOWED_RUN_STATUS = new Set(['started', 'success', 'partial', 'failed', 'skipped']);

export class SourceController {
  constructor(private readonly service: SourceService = new SourceService()) {}

  async listSources(ctx: HttpContext): Promise<void> {
    try {
      const filters = parseSourceFilters(ctx);
      const result = await this.service.listSources(filters);
      const pagination = buildPagination({ limit: filters.limit, offset: filters.offset, total: result.total });
      okPaginated(ctx, result.sources, pagination);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }

  async getSource(ctx: HttpContext): Promise<void> {
    try {
      const key = parseSourceId(ctx.params['id'] ?? '');
      const detail = await this.service.getSourceByKey(key);
      ok(ctx, detail);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }

  async getSourceHealth(ctx: HttpContext): Promise<void> {
    try {
      const rows = await this.service.getSourceHealth();
      ok(ctx, rows);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }

  async listCrawlRuns(ctx: HttpContext): Promise<void> {
    try {
      const filters = parseCrawlRunFilters(ctx);
      const result = await this.service.listCrawlRuns(filters);
      const pagination = buildPagination({ limit: filters.limit, offset: filters.offset, total: result.total });
      okPaginated(ctx, result.runs, pagination);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }
}

function parseSourceFilters(ctx: HttpContext) {
  const q = ctx.query;
  const type = q.get('type') ?? undefined;
  if (type && !ALLOWED_TYPES.has(type)) {
    throw new AppError('VALIDATION_ERROR', `Invalid source type: ${type}`, 400, [{ field: 'type', reason: 'Not allowed.' }]);
  }
  const tier = q.get('reliability_tier') ?? undefined;
  if (tier && !ALLOWED_TIERS.has(tier)) {
    throw new AppError('VALIDATION_ERROR', `Invalid reliability_tier: ${tier}`, 400, [{ field: 'reliability_tier', reason: 'Not allowed.' }]);
  }
  let active: boolean | undefined = true;
  const activeRaw = q.get('active');
  if (activeRaw !== null) {
    if (activeRaw === 'true' || activeRaw === '1') active = true;
    else if (activeRaw === 'false' || activeRaw === '0') active = false;
    else throw new AppError('VALIDATION_ERROR', 'active must be true or false', 400, [{ field: 'active', reason: 'Boolean.' }]);
  }
  const { limit, offset } = resolvePagination(q, 100);
  return {
    type: type as SourceType | undefined,
    active,
    reliability_tier: tier as ReliabilityTier | undefined,
    limit,
    offset,
  };
}

function parseSourceId(id: string): string {
  if (!id.startsWith('src_')) {
    throw new AppError('VALIDATION_ERROR', 'Source id must start with "src_".', 400, [{ field: 'id', reason: 'Must start with "src_".' }]);
  }
  return id.slice('src_'.length);
}

function parseCrawlRunFilters(ctx: HttpContext) {
  const q = ctx.query;
  const status = q.get('status') ?? undefined;
  if (status && !ALLOWED_RUN_STATUS.has(status)) {
    throw new AppError('VALIDATION_ERROR', `Invalid status: ${status}`, 400, [{ field: 'status', reason: 'Not allowed.' }]);
  }
  const from = q.get('from') ?? undefined;
  const to = q.get('to') ?? undefined;
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new AppError('VALIDATION_ERROR', 'from must be YYYY-MM-DD', 400, [{ field: 'from', reason: 'ISO date.' }]);
  }
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new AppError('VALIDATION_ERROR', 'to must be YYYY-MM-DD', 400, [{ field: 'to', reason: 'ISO date.' }]);
  }
  const { limit, offset } = resolvePagination(q, 1000);
  return {
    source_key: q.get('source_key') ?? undefined,
    status: status as CrawlRunStatus | undefined,
    from,
    to,
    limit,
    offset,
  };
}