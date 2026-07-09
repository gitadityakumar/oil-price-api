import type { IncomingMessage } from 'node:http';
import type { HttpContext } from './context';
import { AppError } from '../errors/app-error';

export type Next = () => Promise<void>;

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1MB default cap

export interface ParsedBody {
  bytes: Buffer;
  json: unknown | undefined;
}

/**
 * Read the raw request body as a Buffer, enforcing a size cap. Returns the
 * raw bytes; callers decide whether to parse JSON.
 */
export function readRawBody(
  req: IncomingMessage,
  maxBytes = MAX_BODY_BYTES,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let aborted = false;

    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      total += chunk.length;
      if (total > maxBytes) {
        aborted = true;
        req.destroy();
        reject(new AppError('VALIDATION_ERROR', `Request body exceeds ${maxBytes} bytes`, 413));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (err) => {
      if (aborted) return;
      reject(new AppError('VALIDATION_ERROR', `Failed reading body: ${err.message}`));
    });
  });
}

/** Parse a buffer as JSON, returning undefined for empty bodies. */
export function parseJsonBody(bytes: Buffer, required = false): unknown {
  if (bytes.length === 0) {
    if (required) throw new AppError('VALIDATION_ERROR', 'Request body is required');
    return undefined;
  }
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Request body is not valid JSON');
  }
}

export function canHaveBody(method: string): boolean {
  return BODY_METHODS.has(method.toUpperCase());
}

export function isJsonContentType(req: IncomingMessage): boolean {
  const ct = req.headers['content-type'] ?? '';
  return ct.toLowerCase().includes('application/json');
}

/**
 * Parse JSON request bodies for methods that can carry a body. Empty bodies and
 * non-JSON content types are skipped safely.
 */
export function jsonBodyMiddleware(): (ctx: HttpContext, next: Next) => Promise<void> {
  return async (ctx, next) => {
    if (canHaveBody(ctx.method) && isJsonContentType(ctx.req)) {
      try {
        const bytes = await readRawBody(ctx.req);
        ctx.body = parseJsonBody(bytes);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('VALIDATION_ERROR', 'Failed reading request body');
      }
    }
    await next();
  };
}