import type { Middleware } from './types';
import { logger } from '../logging/logger';

const log = logger.child('http');

/** Log method/path/status/duration for every request. */
export const accessLogMiddleware: Middleware = async (ctx, next) => {
  const start = ctx.startedAt ?? Date.now();
  await next();
  const durationMs = Date.now() - start;
  const status = ctx.res.statusCode;
  if (status >= 500) {
    log.error('request', {
      request_id: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      status,
      duration_ms: durationMs,
    });
  } else if (status >= 400) {
    log.warn('request', {
      request_id: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      status,
      duration_ms: durationMs,
    });
  } else {
    log.info('request', {
      request_id: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      status,
      duration_ms: durationMs,
    });
  }
};