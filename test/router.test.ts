import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../src/core/router/router';
import type { HttpContext } from '../src/core/http/context';

test('task10 router: path params and route pattern are captured', async () => {
  const router = new Router();
  let seen: string | undefined;
  router.get('/v1/prices/:id/components', (ctx) => {
    seen = `${ctx.routePattern}:${ctx.params.id}`;
  });

  await router.handle(ctx('GET', '/v1/prices/price_1/components'));
  assert.equal(seen, '/v1/prices/:id/components:price_1');
});

function ctx(method: string, path: string): HttpContext {
  return {
    req: {} as never,
    res: { hasHeader: () => false, setHeader: () => {}, end: () => {} } as never,
    requestId: 'req_test',
    method,
    path,
    url: new URL(path, 'http://localhost'),
    params: {},
    query: new URLSearchParams(),
    headers: {},
    startedAt: Date.now(),
  };
}
