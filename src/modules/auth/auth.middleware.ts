import type { Middleware } from '../../core/middleware/types';
import { AuthService } from './auth.service';

const defaultAuthService = new AuthService();

export function apiKeyAuthMiddleware(service: AuthService = defaultAuthService): Middleware {
  return async (ctx, next) => {
    ctx.client = await service.authenticate(ctx.headers);
    await next();
  };
}
