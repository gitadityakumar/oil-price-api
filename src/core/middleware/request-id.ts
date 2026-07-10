import { randomUUID } from 'node:crypto';
import type { Middleware } from './types';

const HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** Generate or propagate an x-request-id header. */
export const requestIdMiddleware: Middleware = async (ctx, next) => {
  const incoming = ctx.headers[HEADER];
  const id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  ctx.requestId = id;
  ctx.res.setHeader(HEADER, id);
  await next();
};
