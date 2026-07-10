import type { HttpContext } from '../http/context';
import { assertAuthenticated } from './auth-required';
import { RateLimitService } from '../../modules/auth/rate-limit.service';
import { AppError } from '../errors/app-error';

const defaultRateLimitService = new RateLimitService();

export async function enforceRateLimit(ctx: HttpContext, service: RateLimitService = defaultRateLimitService): Promise<void> {
  assertAuthenticated(ctx);
  try {
    const result = await service.consume(ctx.client!);
    setRateLimitHeaders(ctx, result);
  } catch (error) {
    if (error instanceof AppError && error.code === 'RATE_LIMITED' && isRateLimitDetails(error.details)) {
      setRateLimitHeaders(ctx, error.details);
      ctx.res.setHeader('retry-after', String(Math.max(1, error.details.resetAt - Math.floor(Date.now() / 1000))));
    }
    throw error;
  }
}

function setRateLimitHeaders(ctx: HttpContext, result: { limit: number; remaining: number; resetAt: number }): void {
  ctx.res.setHeader('x-rate-limit-limit', String(result.limit));
  ctx.res.setHeader('x-rate-limit-remaining', String(result.remaining));
  ctx.res.setHeader('x-rate-limit-reset', String(result.resetAt));
}

function isRateLimitDetails(value: unknown): value is { limit: number; remaining: number; resetAt: number } {
  if (!value || typeof value !== 'object') return false;
  const details = value as Record<string, unknown>;
  return typeof details.limit === 'number' && typeof details.remaining === 'number' && typeof details.resetAt === 'number';
}
