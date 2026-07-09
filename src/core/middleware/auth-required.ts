import { AppError } from '../errors/app-error';
import type { HttpContext } from '../http/context';
import { AuthService } from '../../modules/auth/auth.service';

const defaultAuthService = new AuthService();

export async function requireApiKeyAuth(ctx: HttpContext, service: AuthService = defaultAuthService): Promise<void> {
  ctx.client = await service.authenticate(ctx.headers);
}

export function assertAuthenticated(ctx: HttpContext): void {
  if (!ctx.client) throw new AppError('AUTH_REQUIRED', 'API key is required', 401);
}
