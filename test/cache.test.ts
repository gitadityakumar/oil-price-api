import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCache } from '../src/core/cache/memory-cache';
import { priceSearchCacheKey } from '../src/core/cache/cache-key';
import { RedisCache } from '../src/core/cache/redis-cache';
import { closeRedis } from '../src/core/redis/redis-client';
import { RateLimitService } from '../src/modules/auth/rate-limit.service';
import { MemoryAuthRepository } from '../src/modules/auth/auth.repository';

test('task10 cache: key is stable and memory TTL expires', async () => {
  const key = priceSearchCacheKey({
    selector: { type: 'pin', pin: '110001' },
    fuels: ['PETROL'],
    date: '2026-07-09',
    includes: ['source'],
  });
  assert.equal(key, priceSearchCacheKey({
    selector: { type: 'pin', pin: '110001' },
    fuels: ['PETROL'],
    date: '2026-07-09',
    includes: ['source'],
  }));

  const cache = new MemoryCache();
  await cache.set('k', 'v', 0);
  assert.equal(await cache.get('k'), null);
});

test('redis cache and atomic minute limiter integrate locally', { skip: !process.env.REDIS_URL }, async () => {
  const cache = new RedisCache();
  const key = `oil-api:test:${Date.now()}`;
  try {
    await cache.set(key, { ok: true }, 30);
    assert.deepEqual(await cache.get(key), { ok: true });
    assert.ok((await cache.ttl(key))! > 0);

    const limiter = new RateLimitService(new MemoryAuthRepository(), true);
    const client = {
      api_client_id: 999,
      client_id: `redis_${Date.now()}`,
      name: 'Redis integration',
      tier: 'test',
      scopes: ['read:public'],
      rate_limit_per_minute: 1,
      quota_per_day: null,
    };
    await limiter.consume(client);
    await assert.rejects(() => limiter.consume(client), { code: 'RATE_LIMITED' });
  } finally {
    await cache.delete(key);
    await closeRedis();
  }
});
