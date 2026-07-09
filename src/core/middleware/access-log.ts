import type { Middleware } from './types';
import { logger } from '../logging/logger';

const log = logger.child('http');

/** Log method/path/status/duration for every request. */
export const accessLogMiddleware: Middleware = async (ctx, next) => {
  const start = ctx.startedAt ?? Date.now();
  await next();
  const durationMs = Date.now() - start;
  const status = ctx.res.statusCode;
  const base = {
    request_id: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    status_code: status,
    duration_ms: durationMs,
    client_id: ctx.client?.client_id,
    tier: ctx.client?.tier,
    cache_status: ctx.cacheStatus,
    error_code: ctx.errorCode,
  };
  if (status >= 500) {
    log.error('request', base);
  } else if (status >= 400) {
    log.warn('request', base);
  } else {
    log.info('request', base);
  }
};
