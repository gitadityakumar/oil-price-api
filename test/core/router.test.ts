import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../../src/core/router/router';
import { AppError } from '../../src/core/errors/app-error';
import type { HttpContext } from '../../src/core/http/context';

function makeCtx(method: string, path: string): HttpContext {
  const url = new URL(path, 'http://localhost');
  return {
    req: {} as never,
    res: { hasHeader: () => false, setHeader: () => {}, end: () => {} } as never,
    requestId: 'test',
    method,
    path: path,
    url,
    params: {},
    query: url.searchParams,
    headers: {},
    startedAt: Date.now(),
  } as HttpContext;
}

test('router: GET match with params', async () => {
  const r = new Router();
  let captured: Record<string, string> | undefined;
  r.get('/v1/prices/:id/components', (ctx) => { captured = ctx.params; });
  await r.handle(makeCtx('GET', '/v1/prices/xyz/components'));
  assert.deepEqual(captured, { id: 'xyz' });
});

test('router: 404 unknown path', async () => {
  const r = new Router();
  r.get('/v1/health', () => {});
  let thrown: AppError | undefined;
  try { await r.handle(makeCtx('GET', '/nope')); } catch (e) { thrown = e as AppError; }
  assert.equal(thrown?.code, 'NOT_FOUND');
  assert.equal(thrown?.statusCode, 404);
});

test('router: 405 when path matches another method', async () => {
  const r = new Router();
  r.get('/v1/health', () => {});
  let thrown: AppError | undefined;
  try { await r.handle(makeCtx('DELETE', '/v1/health')); } catch (e) { thrown = e as AppError; }
  assert.equal(thrown?.code, 'METHOD_NOT_ALLOWED');
  assert.equal(thrown?.statusCode, 405);
  assert.deepEqual((thrown?.details as { allowed: string[] }).allowed, ['GET']);
});

test('router: trailing slash ignored', async () => {
  const r = new Router();
  let called = false;
  r.get('/v1/health', () => { called = true; });
  await r.handle(makeCtx('GET', '/v1/health/'));
  assert.equal(called, true);
});