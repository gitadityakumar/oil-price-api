import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HttpContext } from '../../src/core/http/context';
import { AuthService } from '../../src/modules/auth/auth.service';
import { generateApiKey } from '../../src/modules/auth/api-key-generator';
import { MemoryAuthRepository } from '../../src/modules/auth/auth.repository';
import { requireScopes } from '../../src/core/middleware/scope-required';
import { RateLimitService } from '../../src/modules/auth/rate-limit.service';
import { accessLogMiddleware } from '../../src/core/middleware/access-log';
import type { ApiClientRow, AuthenticatedClient } from '../../src/modules/auth/auth.model';

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
