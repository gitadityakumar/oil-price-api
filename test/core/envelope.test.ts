import { test } from 'node:test';
import assert from 'node:assert/strict';
import { successEnvelope, errorEnvelope, API_VERSION } from '../../src/core/http/envelope';

test('successEnvelope: shape with request_id and api_version', () => {
  const env = successEnvelope({ a: 1 }, 'req_1');
  assert.equal(env.data.a, 1);
  assert.equal(env.meta.request_id, 'req_1');
  assert.equal(env.meta.api_version, API_VERSION);
  assert.ok(typeof env.meta.served_at === 'string');
  assert.ok(!('cache' in env.meta));
  assert.ok(!('pagination' in env.meta));
});

test('successEnvelope: includes cache when provided', () => {
  const env = successEnvelope([], 'req', { cache: { status: 'HIT', ttl_seconds: 60 } });
  assert.equal(env.meta.cache?.status, 'HIT');
  assert.equal(env.meta.cache?.ttl_seconds, 60);
});

test('successEnvelope: includes pagination when provided', () => {
  const env = successEnvelope([], 'req', { pagination: { limit: 50, offset: 0, next_offset: 50, total: 100 } });
  assert.equal(env.meta.pagination?.next_offset, 50);
  assert.equal(env.meta.pagination?.total, 100);
});

test('errorEnvelope: shape with request_id inside error', () => {
  const env = errorEnvelope('req_9', 'VALIDATION_ERROR', 'bad input', [{ field: 'pin', reason: 'must be 6 digits' }]);
  assert.equal(env.error.code, 'VALIDATION_ERROR');
  assert.equal(env.error.message, 'bad input');
  assert.equal(env.error.request_id, 'req_9');
  assert.deepEqual(env.error.details, [{ field: 'pin', reason: 'must be 6 digits' }]);
});

test('errorEnvelope: details undefined when not provided', () => {
  const env = errorEnvelope('req', 'NOT_FOUND', 'no such');
  assert.equal(env.error.details, undefined);
});