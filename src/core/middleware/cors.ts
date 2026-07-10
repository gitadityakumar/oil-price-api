import type { Middleware } from './types';

const DEFAULT_ALLOW_ORIGIN = '*';
const DEFAULT_ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const DEFAULT_ALLOW_HEADERS = 'content-type, authorization, x-client-id, x-api-key, x-request-id';
const MAX_AGE = '600';

export interface CorsOptions {
  allowOrigin?: string;
  allowMethods?: string;
  allowHeaders?: string;
  exposeHeaders?: string;
  credentials?: boolean;
  maxAge?: string;
}

/** Handle CORS headers and OPTIONS preflight. */
export function corsMiddleware(options: CorsOptions = {}): Middleware {
  const allowOrigin = options.allowOrigin ?? DEFAULT_ALLOW_ORIGIN;
  const allowMethods = options.allowMethods ?? DEFAULT_ALLOW_METHODS;
  const allowHeaders = options.allowHeaders ?? DEFAULT_ALLOW_HEADERS;
  const exposeHeaders = options.exposeHeaders;
  const credentials = options.credentials ?? false;
  const maxAge = options.maxAge ?? MAX_AGE;

  if (credentials && allowOrigin === '*') {
    throw new TypeError('CORS credentials cannot be enabled with a wildcard origin');
  }

  return async (ctx, next) => {
    ctx.res.setHeader('access-control-allow-origin', allowOrigin);
    if (credentials) {
      ctx.res.setHeader('access-control-allow-credentials', 'true');
    }
    if (exposeHeaders) {
      ctx.res.setHeader('access-control-expose-headers', exposeHeaders);
    }
    ctx.res.setHeader('access-control-allow-methods', allowMethods);
    ctx.res.setHeader('access-control-allow-headers', allowHeaders);
    ctx.res.setHeader('access-control-max-age', maxAge);

    if (ctx.method.toUpperCase() === 'OPTIONS') {
      if (ctx.responded) return;
      ctx.responded = true;
      ctx.res.statusCode = 204;
      ctx.res.end();
      return;
    }
    await next();
  };
}
