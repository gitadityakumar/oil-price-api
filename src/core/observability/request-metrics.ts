import type { Middleware } from '../middleware/types';
import { metrics, recordCacheStatus } from './metrics';

export const requestMetricsMiddleware: Middleware = async (ctx, next) => {
  try {
    await next();
  } finally {
    const durationMs = Date.now() - ctx.startedAt;
    const route = ctx.routePattern ?? '__unmatched__';
    const status = String(ctx.res.statusCode);
    metrics.increment('http_requests_total', { route, status });
    metrics.observeDuration('http_request_duration_ms', durationMs, { route, status });
    if (ctx.cacheStatus) recordCacheStatus(ctx.cacheStatus);
  }
};
