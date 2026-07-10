import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HttpContext } from '../../src/core/http/context';
import { AuthService } from '../../src/modules/auth/auth.service';
import { generateApiKey } from '../../src/modules/auth/api-key-generator';
import { MemoryAuthRepository, PgAuthRepository } from '../../src/modules/auth/auth.repository';
import { requireScopes } from '../../src/core/middleware/scope-required';
import { RateLimitService } from '../../src/modules/auth/rate-limit.service';
import { accessLogMiddleware } from '../../src/core/middleware/access-log';
import type { ApiClientRow, AuthenticatedClient } from '../../src/modules/auth/auth.model';
import { enforceRateLimit } from '../../src/core/middleware/rate-limit';
import { query } from '../../src/db/query';

const PEPPER = 'test-pepper';

function row(input: {
  client_id: string;
  key_hash: string;
  status?: ApiClientRow['status'];
  scopes?: string[];
  rateLimit?: number;
  quota?: number | null;
}): ApiClientRow {
  return {
    api_client_id: 1,
    client_id: input.client_id,
    name: 'Test Client',
    key_hash: input.key_hash,
    status: input.status ?? 'active',
    tier: 'free',
    scopes: input.scopes ?? ['read:public'],
    rate_limit_per_minute: input.rateLimit ?? 60,
    quota_per_day: input.quota ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_used_at: null,
  };
}

function ctx(headers: Record<string, string> = {}, client?: AuthenticatedClient): HttpContext {
  return {
    req: {} as never,
    res: {
      statusCode: 200,
      hasHeader: () => false,
      setHeader: () => {},
      end: () => {},
    } as never,
    requestId: 'req_test',
    method: 'GET',
    path: '/v1/prices',
    url: new URL('http://localhost/v1/prices'),
    params: {},
    query: new URLSearchParams(),
    headers,
    client,
    startedAt: Date.now(),
  };
}

test('auth: missing key -> AUTH_REQUIRED', async () => {
  const service = new AuthService(new MemoryAuthRepository(), PEPPER);
  await assert.rejects(() => service.authenticate({}), { code: 'AUTH_REQUIRED' });
});

test('auth: invalid key -> AUTH_INVALID', async () => {
  const generated = generateApiKey({ pepper: PEPPER });
  const repo = new MemoryAuthRepository([row({ client_id: generated.client_id, key_hash: generated.key_hash })]);
  const service = new AuthService(repo, PEPPER);
  await assert.rejects(
    () => service.authenticate({ authorization: `Bearer ${generated.api_key}wrong` }),
    { code: 'AUTH_INVALID' },
  );
});

test('auth: revoked key -> AUTH_INVALID', async () => {
  const generated = generateApiKey({ pepper: PEPPER });
  const repo = new MemoryAuthRepository([row({ client_id: generated.client_id, key_hash: generated.key_hash, status: 'revoked' })]);
  const service = new AuthService(repo, PEPPER);
  await assert.rejects(
    () => service.authenticate({ authorization: `Bearer ${generated.api_key}` }),
    { code: 'AUTH_INVALID' },
  );
});

test('auth: x-client-id and x-api-key format authenticates', async () => {
  const generated = generateApiKey({ pepper: PEPPER });
  const repo = new MemoryAuthRepository([row({ client_id: generated.client_id, key_hash: generated.key_hash })]);
  const service = new AuthService(repo, PEPPER);
  const client = await service.authenticate({ 'x-client-id': generated.client_id, 'x-api-key': generated.api_key });
  assert.equal(client.client_id, generated.client_id);
});

test('scope: missing scope -> FORBIDDEN', () => {
  const client = {
    api_client_id: 1,
    client_id: 'cli_test',
    name: 'Test',
    tier: 'free',
    scopes: ['read:public'],
    rate_limit_per_minute: 60,
    quota_per_day: null,
  };
  assert.throws(() => requireScopes(ctx({}, client), ['read:internal']), { code: 'FORBIDDEN' });
});

test('rate limit: exceeded -> RATE_LIMITED and headers model present', async () => {
  const client = {
    api_client_id: 1,
    client_id: 'cli_test',
    name: 'Test',
    tier: 'free',
    scopes: ['read:public'],
    rate_limit_per_minute: 1,
    quota_per_day: null,
  };
  const service = new RateLimitService(new MemoryAuthRepository());
  const first = await service.consume(client, new Date('2026-07-10T00:00:00.000Z'));
  assert.equal(first.limit, 1);
  assert.equal(first.remaining, 0);
  assert.ok(first.resetAt > 0);
  await assert.rejects(
    () => service.consume(client, new Date('2026-07-10T00:00:01.000Z')),
    { code: 'RATE_LIMITED' },
  );
});

test('rate limit: daily quota exceeded', async () => {
  const client = {
    api_client_id: 1,
    client_id: 'cli_test',
    name: 'Test',
    tier: 'free',
    scopes: ['read:public'],
    rate_limit_per_minute: 60,
    quota_per_day: 1,
  };
  const service = new RateLimitService(new MemoryAuthRepository());
  await service.consume(client, new Date('2026-07-10T00:00:00.000Z'));
  await assert.rejects(
    () => service.consume(client, new Date('2026-07-10T00:00:01.000Z')),
    { code: 'RATE_LIMITED', message: 'Daily quota exceeded' },
  );
});

test('rate limit: zero daily quota rejects the first request', async () => {
  const client = {
    api_client_id: 3,
    client_id: 'cli_zero_quota',
    name: 'Zero quota',
    tier: 'free',
    scopes: ['read:public'],
    rate_limit_per_minute: 60,
    quota_per_day: 0,
  };
  const service = new RateLimitService(new MemoryAuthRepository());
  await assert.rejects(
    () => service.consume(client, new Date('2026-07-10T00:00:00.000Z')),
    { code: 'RATE_LIMITED', message: 'Daily quota exceeded' },
  );
});

test('rate limit middleware writes headers on 429', async () => {
  const client: AuthenticatedClient = {
    api_client_id: 2,
    client_id: 'cli_headers',
    name: 'Headers',
    tier: 'free',
    scopes: ['read:public'],
    rate_limit_per_minute: 1,
    quota_per_day: null,
  };
  const headers = new Map<string, string>();
  const context = ctx({}, client);
  context.res.setHeader = (name: string, value: string | number | readonly string[]) => { headers.set(name, String(value)); return context.res; };
  const service = new RateLimitService(new MemoryAuthRepository());
  await enforceRateLimit(context, service);
  await assert.rejects(() => enforceRateLimit(context, service), { code: 'RATE_LIMITED' });
  assert.equal(headers.get('x-rate-limit-limit'), '1');
  assert.equal(headers.get('x-rate-limit-remaining'), '0');
  assert.ok(headers.has('x-rate-limit-reset'));
  assert.ok(headers.has('retry-after'));
});

test('auth: timing safe compare handles unequal lengths safely', async () => {
  const { safeHashEquals } = await import('../../src/modules/auth/auth.service');
  assert.equal(safeHashEquals('abcd', 'abcdef'), false);
});

test('logs: api key is never logged', async () => {
  const apiKey = 'ifp_test_cli_test_deadbeef';
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  let output = '';
  const capture = (chunk: string | Uint8Array): boolean => {
    output += chunk.toString();
    return true;
  };
  process.stdout.write = capture as typeof process.stdout.write;
  process.stderr.write = capture as typeof process.stderr.write;
  try {
    await accessLogMiddleware(ctx({ authorization: `Bearer ${apiKey}` }), async () => {});
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
  assert.equal(output.includes(apiKey), false);
});

test('DB: daily quota admission is atomic', { skip: !process.env.DATABASE_URL }, async () => {
  const clientId = `cli_quota_${Date.now()}`;
  const inserted = await query<{ api_client_id: number }>(
    `insert into api_client (client_id, name, key_hash, status, tier, scopes, rate_limit_per_minute, quota_per_day)
     values ($1, 'Quota concurrency', 'test-hash', 'active', 'test', array['read:public'], 100, 1)
     returning api_client_id`,
    [clientId],
  );
  const apiClientId = Number(inserted.rows[0].api_client_id);
  const repository = new PgAuthRepository();
  const zero = await repository.consumeDailyQuota(apiClientId, '2026-07-09', 0);
  assert.equal(zero.allowed, false);
  assert.equal(await repository.getDailyUsage(apiClientId, '2026-07-09'), 0);
  const results = await Promise.all(Array.from({ length: 10 }, () => repository.consumeDailyQuota(apiClientId, '2026-07-10', 1)));
  assert.equal(results.filter((result) => result.allowed).length, 1);
  await query('delete from api_usage_daily where api_client_id = $1', [apiClientId]);
  await query('delete from api_client where api_client_id = $1', [apiClientId]);
  const { closePool } = await import('../../src/db/pool');
  await closePool();
});
