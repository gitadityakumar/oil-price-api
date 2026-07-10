import type { Cache } from './cache.model';
import { getRedisClient, withRedisDeadline } from '../redis/redis-client';

/**
 * Redis adapter boundary. A real Redis client dependency is intentionally not
 * added until Task 9/production ops; the cache factory only instantiates this
 * when REDIS_URL is present. The class keeps the contract explicit and ready
 * for a small client integration without changing callers.
 */
export class RedisCache implements Cache {
  constructor(_redisUrl?: string) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await withRedisDeadline((await getRedisClient()).get(key));
    return value === null ? null : JSON.parse(value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) {
      await this.delete(key);
      return;
    }
    await withRedisDeadline((await getRedisClient()).set(key, JSON.stringify(value), { EX: ttlSeconds }));
  }

  async delete(key: string): Promise<void> {
    await withRedisDeadline((await getRedisClient()).del(key));
  }

  async ttl(key: string): Promise<number | null> {
    const ttl = await withRedisDeadline((await getRedisClient()).ttl(key));
    return ttl < 0 ? null : ttl;
  }
}
