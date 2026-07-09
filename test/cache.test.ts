import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCache } from '../src/core/cache/memory-cache';
import { priceSearchCacheKey } from '../src/core/cache/cache-key';

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
