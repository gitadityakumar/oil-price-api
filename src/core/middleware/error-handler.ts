import type { Middleware } from './types';
import { AppError } from '../errors/app-error';
import { error } from '../http/response';
import { logger } from '../logging/logger';

const log = logger.child('error-handler');

/** Convert thrown errors into the standard JSON error envelope. */
export const errorHandlerMiddleware: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const appError = AppError.fromUnknown(err);
    ctx.errorCode = appError.code;
    if (appError.statusCode >= 500) {
      log.error('request failed', {
        request_id: ctx.requestId,
        code: appError.code,
        error_type: errorType(appError.cause ?? err),
      });
    }
    if (ctx.responded) {
      // Headers already sent; we can only log.
      ctx.res.destroy?.();
      return;
    }
    error(ctx, appError);
  }
};

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
