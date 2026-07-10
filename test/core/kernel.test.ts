import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpContext } from '../../src/core/http/context';
import { MetricsRegistry, metrics } from '../../src/core/observability/metrics';

function fakeReq(method: string, path: string, body?: string, headers: Record<string, string> = {}): IncomingMessage {
  const chunks = body ? [Buffer.from(body)] : [];
  const req = {
    method,
    url: path,
    headers: { 'content-type': body ? 'application/json' : undefined, ...headers },
    on: (ev: string, cb: (arg?: unknown) => void) => {
      if (ev === 'data' && chunks.length) setTimeout(() => cb(chunks.shift()), 0);
      if (ev === 'end') setTimeout(() => cb(), 0);
    },
    destroy: () => {},
  } as unknown as IncomingMessage;
  return req;
}

function fakeRes(): { res: ServerResponse; state: { body: string; statusCode: number; headers: Record<string, string | string[]> } } {
  const state = { body: '', statusCode: 200, headers: {} as Record<string, string | string[]> };
  const res = {
    statusCode: 200,
    hasHeader: (k: string) => Object.prototype.hasOwnProperty.call(state.headers, k.toLowerCase()),
    setHeader: (k: string, v: string | string[]) => { state.headers[k.toLowerCase()] = v; },
    getHeader: (k: string) => state.headers[k.toLowerCase()],
    end: (b?: string | Buffer) => { state.body = b ? b.toString() : ''; },
    destroy: () => {},
    writableEnded: false,
  } as unknown as ServerResponse;
  Object.defineProperty(res, 'statusCode', { get: () => state.statusCode, set: (v: number) => { state.statusCode = v; } });
  return { res, state };
}

async function call(app: ReturnType<typeof createApp>, method: string, path: string, body?: string, headers?: Record<string, string>) {
  const req = fakeReq(method, path, body, headers);
  const { res, state } = fakeRes();
  await app.handle(req, res);
  return { statusCode: state.statusCode, body: state.body, headers: state.headers };
}

test('health returns success envelope', async () => {
  const app = createApp({ cors: { allowOrigin: '*' } });
  const { statusCode, body } = await call(app, 'GET', '/v1/health');
  assert.equal(statusCode, 200);
  const parsed = JSON.parse(body);
  assert.equal(parsed.data.status, 'ok');
  assert.ok(parsed.meta.request_id, 'request_id present');
  assert.equal(parsed.meta.api_version, 'v1');
  assert.ok(parsed.meta.served_at, 'served_at present');
});

test('x-request-id header set on response', async () => {
  const app = createApp();
  const { headers } = await call(app, 'GET', '/v1/health');
  assert.ok(headers['x-request-id'], 'x-request-id set');
});

test('ingestion endpoint requires auth before controller validation', async () => {
  const app = createApp();
  const { statusCode, body } = await call(app, 'POST', '/v1/internal/ingestion/runs');
  assert.equal(statusCode, 401);
  const parsed = JSON.parse(body);
  assert.equal(parsed.error.code, 'AUTH_REQUIRED');
});

test('unknown path returns 404 envelope', async () => {
  const app = createApp();
  const { statusCode, body } = await call(app, 'GET', '/nope');
  assert.equal(statusCode, 404);
  const parsed = JSON.parse(body);
  assert.equal(parsed.error.code, 'NOT_FOUND');
});

test('wrong method returns 405 envelope', async () => {
  const app = createApp();
  const { statusCode, body } = await call(app, 'DELETE', '/v1/health');
  assert.equal(statusCode, 405);
  const parsed = JSON.parse(body);
  assert.equal(parsed.error.code, 'METHOD_NOT_ALLOWED');
  assert.deepEqual(parsed.error.details.allowed, ['GET']);
});

test('OPTIONS preflight returns 204', async () => {
  const app = createApp();
  const { statusCode } = await call(app, 'OPTIONS', '/v1/health');
  assert.equal(statusCode, 204);
});

test('query params parse and reach ctx', async () => {
  let captured: URLSearchParams | undefined;
  const app = createApp({
    middlewares: [
      async (ctx: HttpContext, next) => {
        if (ctx.path === '/v1/health') captured = ctx.query;
        await next();
      },
    ],
  });
  await call(app, 'GET', '/v1/health?fresh=1&fuel=PETROL');
  assert.equal(captured?.get('fresh'), '1');
  assert.equal(captured?.get('fuel'), 'PETROL');
});

test('error handler maps AppError to expected status/code', async () => {
  const app = createApp();
  const { statusCode, body } = await call(app, 'GET', '/unknown-deep-path');
  assert.equal(statusCode, 404);
  assert.equal(JSON.parse(body).error.code, 'NOT_FOUND');
});

test('malformed JSON uses the standard validation envelope', async () => {
  const app = createApp();
  const result = await call(app, 'POST', '/v1/internal/ingestion/runs', '{bad');
  assert.equal(result.statusCode, 400);
  const parsed = JSON.parse(result.body);
  assert.equal(parsed.error.code, 'VALIDATION_ERROR');
  assert.ok(parsed.error.request_id);
  assert.equal(parsed.error.request_id, result.headers['x-request-id']);
});

test('unknown internal errors never expose their message', async () => {
  const app = createApp({
    middlewares: [async () => { throw new Error('postgres://user:secret@db/private'); }],
  });
  const result = await call(app, 'GET', '/v1/health');
  assert.equal(result.statusCode, 500);
  assert.equal(result.body.includes('secret'), false);
  assert.equal(JSON.parse(result.body).error.message, 'An unexpected error occurred');
});

test('unknown paths use one bounded metrics label with final 404 status', async () => {
  metrics.reset();
  const app = createApp();
  await call(app, 'GET', '/missing/one');
  await call(app, 'GET', '/missing/two');
  const keys = Object.keys(metrics.snapshot().counters).filter((key) => key.startsWith('http_requests_total'));
  assert.deepEqual(keys, ['http_requests_total{route=__unmatched__,status=404}']);
});

test('invalid request IDs are replaced and unsafe CORS is rejected', async () => {
  const app = createApp();
  const result = await call(app, 'GET', '/v1/health', undefined, { 'x-request-id': 'bad request id' });
  assert.notEqual(result.headers['x-request-id'], 'bad request id');
  assert.throws(() => createApp({ cors: { allowOrigin: '*', credentials: true } }), /wildcard origin/);
});

test('metrics registry drops new series at its configured bound', () => {
  const registry = new MetricsRegistry(1);
  registry.increment('requests', { route: '/one' });
  registry.increment('requests', { route: '/two' });
  assert.equal(registry.snapshot().internal.dropped_series_total, 1);
});
