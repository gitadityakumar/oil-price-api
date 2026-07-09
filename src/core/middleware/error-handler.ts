import type { Middleware } from './types';
import { AppError } from '../errors/app-error';
import { error } from '../http/response';

/** Convert thrown errors into the standard JSON error envelope. */
export const errorHandlerMiddleware: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const appError = AppError.fromUnknown(err);
    if (ctx.responded) {
      // Headers already sent; we can only log.
      ctx.res.destroy?.();
      return;
    }
    error(ctx, appError);
  }
};