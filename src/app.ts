import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { sendError, sendOk } from './core/http/response';
import { AppError } from './core/errors/app-error';
import { logger } from './core/logging/logger';

const log = logger.child('app');

/**
 * Application request handler. Accepts the raw node:http request/response pair
 * and dispatches to the (minimal) health route or returns 404.
 *
 * The full router + middleware chain arrives in Task 3.
 */
export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);

  const url = req.url ?? '/';
  const pathname = url.split('?')[0];
  const method = req.method ?? 'GET';

  log.info('request', { request_id: requestId, method, path: pathname });

  if (method === 'GET' && pathname === '/health') {
    sendOk(res, { status: 'ok' });
    return;
  }

  const err = new AppError('NOT_FOUND', `Route not found: ${method} ${pathname}`);
  sendError(res, err.statusCode, err.code, err.message);
}

/**
 * Top-level error boundary: wraps the handler so any thrown sync/async error
 * serializes to the standardized JSON error envelope.
 */
export function handleSafe(req: IncomingMessage, res: ServerResponse): void {
  try {
    handleRequest(req, res);
  } catch (err) {
    const appErr = AppError.fromUnknown(err);
    const rid = res.getHeader('X-Request-Id');
    log.error('unhandled error', { request_id: typeof rid === 'string' ? rid : undefined, err: appErr.message });
    if (!res.headersSent) {
      sendError(res, appErr.statusCode, appErr.code, appErr.message, appErr.details);
    }
  }
}