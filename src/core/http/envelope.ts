/**
 * Standard response envelopes for the v1 API contract.
 *
 * Success:  { data, meta: { request_id, api_version, served_at, cache?, pagination? } }
 * Error:    { error: { code, message, details, request_id } }
 *
 * Note the error envelope puts request_id inside error (per the contract), and
 * success puts it in meta.
 */

export type CacheStatus = 'MISS' | 'HIT' | 'BYPASS' | 'STALE';

export interface CacheMeta {
  status: CacheStatus;
  ttl_seconds: number | null;
}

export interface PaginationMeta {
  limit: number;
  offset: number;
  next_offset: number | null;
  total: number;
}

export interface SuccessMeta {
  request_id: string;
  api_version: 'v1';
  served_at: string;
  cache?: CacheMeta;
  pagination?: PaginationMeta;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta: SuccessMeta;
}

export interface ErrorDetail {
  field?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface ErrorEnvelopeBody {
  code: string;
  message: string;
  details?: ErrorDetail[] | Record<string, unknown> | unknown;
  request_id: string;
}

export interface ErrorEnvelope {
  error: ErrorEnvelopeBody;
}

export const API_VERSION = 'v1' as const;

export interface EnvelopeOptions {
  cache?: CacheMeta;
  pagination?: PaginationMeta;
}

/** Build a success envelope object. */
export function successEnvelope<T>(data: T, requestId: string, options?: EnvelopeOptions): SuccessEnvelope<T> {
  const meta: SuccessMeta = {
    request_id: requestId,
    api_version: API_VERSION,
    served_at: new Date().toISOString(),
  };
  if (options?.cache) meta.cache = options.cache;
  if (options?.pagination) meta.pagination = options.pagination;
  return { data, meta };
}

/** Build an error envelope object. */
export function errorEnvelope(
  requestId: string,
  code: string,
  message: string,
  details?: ErrorDetail[] | Record<string, unknown> | unknown,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      details: details ?? undefined,
      request_id: requestId,
    },
  };
}