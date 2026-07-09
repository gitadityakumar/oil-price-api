import { randomUUID } from 'node:crypto';
import type { Middleware } from './types';

const HEADER = 'x-request-id';

/** Generate or propagate an x-request-id header. */
export const requestIdMiddleware: Middleware = async (ctx, next) => {
  const incoming = ctx.headers[HEADER];
  const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
  ctx.requestId = id;
  ctx.res.setHeader(HEADER, id);
  await next();
};