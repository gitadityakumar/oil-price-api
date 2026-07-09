import type { IncomingMessage } from 'node:http';
import type { HttpContext } from './context';

const BASE = 'http://localhost';

/**
 * Parse the request line into a URL object for path + query access. We use a
 * fixed base because req.url is path-relative; only path/query matter here.
 */
export function parseRequestUrl(req: IncomingMessage): URL {
  const raw = req.url ?? '/';
  return new URL(raw, BASE);
}

/** Normalize a path: lowercase method, strip trailing slash except root. */
export function normalizePath(path: string): string {
  if (path === '/') return '/';
  return path.replace(/\/+$/, '');
}

export function getRequestHeader(ctx: HttpContext, name: string): string | undefined {
  const v = ctx.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}