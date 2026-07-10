import type { HttpContext } from './context';
import { AppError } from '../errors/app-error';
import {
  successEnvelope,
  errorEnvelope,
  type CacheMeta,
  type PaginationMeta,
  type EnvelopeOptions,
} from './envelope';

export type Headers = Record<string, string>;

function ensureRequestIdHeader(ctx: HttpContext): void {
  if (!ctx.res.hasHeader('x-request-id')) {
    ctx.res.setHeader('x-request-id', ctx.requestId);
  }
}

function writeJson(ctx: HttpContext, statusCode: number, payload: unknown, headers?: Headers): void {
  if (ctx.responded) return;
  ctx.responded = true;
  const body = JSON.stringify(serialize(payload));
  ctx.res.statusCode = statusCode;
  ctx.res.setHeader('content-type', 'application/json; charset=utf-8');
  ctx.res.setHeader('content-length', Buffer.byteLength(body).toString());
  ensureRequestIdHeader(ctx);
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      ctx.res.setHeader(k, v);
    }
  }
  ctx.res.end(body);
}

/** Recursively convert Date to ISO strings, BigInt to string. */
function serialize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}

/**
 * Standard success envelope: { data, meta: { request_id, api_version,
 * served_at, cache?, pagination? } }. Optional `options.pagination`/`cache`
 * attach those meta blocks.
 */
export function ok<T>(ctx: HttpContext, data: T, statusCode = 200, options?: { headers?: Headers; cache?: CacheMeta; pagination?: PaginationMeta; warnings?: unknown[] }): void {
  const envOptions: EnvelopeOptions = {};
  if (options?.cache) {
    envOptions.cache = options.cache;
    ctx.cacheStatus = options.cache.status;
  }
  if (options?.pagination) envOptions.pagination = options.pagination;
  const payload = successEnvelope(data, ctx.requestId, envOptions);
  if (options?.warnings && options.warnings.length > 0) {
    (payload.meta as { warnings?: unknown[] }).warnings = options.warnings;
  }
  writeJson(ctx, statusCode, payload, options?.headers);
}

/** Success envelope with explicit pagination meta. */
export function okPaginated<T>(ctx: HttpContext, data: T, pagination: PaginationMeta, statusCode = 200, cacheOrWarnings?: { cache?: CacheMeta; warnings?: unknown[] }): void {
  ok(ctx, data, statusCode, { pagination, cache: cacheOrWarnings?.cache, warnings: cacheOrWarnings?.warnings });
}

/** Generic JSON response for non-envelope payloads (used rarely). */
export function json(ctx: HttpContext, statusCode: number, payload: unknown, headers?: Headers): void {
  writeJson(ctx, statusCode, payload, headers);
}

export function noContent(ctx: HttpContext): void {
  if (ctx.responded) return;
  ctx.responded = true;
  ctx.res.statusCode = 204;
  ensureRequestIdHeader(ctx);
  ctx.res.end();
}

export function redirect(ctx: HttpContext, location: string, statusCode = 302): void {
  if (ctx.responded) return;
  ctx.responded = true;
  ctx.res.statusCode = statusCode;
  ctx.res.setHeader('location', location);
  ensureRequestIdHeader(ctx);
  ctx.res.end();
}

/** Standard error envelope: { error: { code, message, details, request_id } } */
export function error(ctx: HttpContext, appError: AppError): void {
  ctx.errorCode = appError.code;
  const payload = errorEnvelope(ctx.requestId, appError.code, appError.publicMessage, appError.publicDetails);
  writeJson(ctx, appError.statusCode, payload);
}

export function notImplemented(ctx: HttpContext, route: string): void {
  error(ctx, new AppError('NOT_IMPLEMENTED', `Route not implemented yet: ${route}`));
}
