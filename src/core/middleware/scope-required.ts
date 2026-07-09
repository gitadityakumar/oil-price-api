import { AppError } from '../errors/app-error';
import type { HttpContext } from '../http/context';
import { assertAuthenticated } from './auth-required';

export function requireScopes(ctx: HttpContext, scopes: readonly string[] = []): void {
  if (scopes.length === 0) return;
  assertAuthenticated(ctx);
  const clientScopes = new Set(ctx.client?.scopes ?? []);
  const missing = scopes.filter((scope) => !clientScopes.has(scope));
  if (missing.length > 0) {
    throw new AppError('FORBIDDEN', 'API client is missing required scope', 403, { missing_scopes: missing });
  }
}
