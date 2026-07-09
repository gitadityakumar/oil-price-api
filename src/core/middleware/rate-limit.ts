import type { HttpContext } from '../http/context';
import { assertAuthenticated } from './auth-required';
import { RateLimitService } from '../../modules/auth/rate-limit.service';

const defaultRateLimitService = new RateLimitService();

export async function enforceRateLimit(ctx: HttpContext, service: RateLimitService = defaultRateLimitService): Promise<void> {
  assertAuthenticated(ctx);
  const result = await service.consume(ctx.client!);
  ctx.res.setHeader('x-rate-limit-limit', String(result.limit));
  ctx.res.setHeader('x-rate-limit-remaining', String(result.remaining));
  ctx.res.setHeader('x-rate-limit-reset', String(result.resetAt));
}
