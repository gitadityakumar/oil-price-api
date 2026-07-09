import type { Middleware } from './types';
import { AppError } from '../errors/app-error';
import { error } from '../http/response';

/** Final fallback when no route matched. The router also throws, this is a safety net. */
export const notFoundMiddleware: Middleware = async (ctx, next) => {
  await next();
  if (!ctx.responded) {
    error(ctx, new AppError('NOT_FOUND', `Route not found: ${ctx.method} ${ctx.path}`, 404));
  }
};