import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpContext } from './core/http/context';
import { parseRequestUrl, normalizePath } from './core/http/request';
import { compose, type Middleware } from './core/middleware/types';
import { requestIdMiddleware } from './core/middleware/request-id';
import { accessLogMiddleware } from './core/middleware/access-log';
import { corsMiddleware } from './core/middleware/cors';
import { errorHandlerMiddleware } from './core/middleware/error-handler';
import { notFoundMiddleware } from './core/middleware/not-found';
import { jsonBodyMiddleware } from './core/http/body';
import { buildRouter } from './routes';
import { logger } from './core/logging/logger';
import { AppError } from './core/errors/app-error';
import { requestMetricsMiddleware } from './core/observability/request-metrics';
import { errorEnvelope } from './core/http/envelope';

const log = logger.child('app');

export interface AppOptions {
  cors?: Parameters<typeof corsMiddleware>[0];
  middlewares?: Middleware[];
}

export class App {
  private readonly handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  readonly router = buildRouter();

  constructor(options: AppOptions = {}) {
    const router = this.router;

    const middlewares: Middleware[] = [
      requestIdMiddleware,
      accessLogMiddleware,
      requestMetricsMiddleware,
      errorHandlerMiddleware,
      corsMiddleware(options.cors),
      securityHeadersMiddleware,
      jsonBodyMiddleware(),
      ...(options.middlewares ?? []),
      notFoundMiddleware,
    ];

    const terminal = async (ctx: HttpContext) => {
      await router.handle(ctx);
    };

    const composed = compose(middlewares, terminal);

    this.handler = async (req, res) => {
      const url = parseRequestUrl(req);
      const ctx: HttpContext = {
        req,
        res,
        requestId: '',
        method: req.method ?? 'GET',
        path: normalizePath(url.pathname),
        url,
        params: {},
        query: url.searchParams,
        headers: req.headers,
        startedAt: Date.now(),
      };
      try {
        await composed(ctx);
      } catch (err) {
        // Safety net beyond errorHandlerMiddleware.
        const appErr = AppError.fromUnknown(err);
        if (!ctx.responded && !res.headersSent) {
          res.statusCode = appErr.statusCode;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(errorEnvelope(ctx.requestId, appErr.code, appErr.publicMessage, appErr.publicDetails)));
        } else if (!res.writableEnded) {
          res.destroy();
        }
        log.error('unhandled after pipeline', { request_id: ctx.requestId, code: appErr.code });
      } finally {
        if (!ctx.responded && !res.writableEnded) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(errorEnvelope(ctx.requestId, 'NOT_FOUND', 'No response written')));
        }
      }
    };
  }

  handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    return this.handler(req, res);
  }
}

export function createApp(options?: AppOptions): App {
  return new App(options);
}

const securityHeadersMiddleware: Middleware = async (ctx, next) => {
  ctx.res.setHeader('x-content-type-options', 'nosniff');
  ctx.res.setHeader('x-frame-options', 'DENY');
  ctx.res.setHeader('referrer-policy', 'no-referrer');
  if (ctx.path.startsWith('/v1/internal/')) {
    ctx.res.setHeader('cache-control', 'no-store');
  }
  await next();
};
