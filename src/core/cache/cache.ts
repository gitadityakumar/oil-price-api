import { config } from '../../config/env';
import type { Cache } from './cache.model';
import { MemoryCache } from './memory-cache';
import { RedisCache } from './redis-cache';
import { logger } from '../logging/logger';

const log = logger.child('cache');

let singleton: Cache | undefined;

export function createCache(): Cache {
  if (config.redisUrl) {
    log.info('redis cache configured');
    return new RedisCache(config.redisUrl);
  }
  log.info('memory cache configured');
  return new MemoryCache();
}

export function getCache(): Cache {
  if (!singleton) singleton = createCache();
  return singleton;
}

export function setCacheForTests(cache: Cache | undefined): void {
  singleton = cache;
}
