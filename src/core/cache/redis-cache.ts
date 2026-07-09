import type { Cache } from './cache.model';

/**
 * Redis adapter boundary. A real Redis client dependency is intentionally not
 * added until Task 9/production ops; the cache factory only instantiates this
 * when REDIS_URL is present. The class keeps the contract explicit and ready
 * for a small client integration without changing callers.
 */
export class RedisCache implements Cache {
  constructor(private readonly redisUrl: string) {}

  async get<T>(_key: string): Promise<T | null> {
    throw new Error(`Redis cache adapter requires a Redis client integration for ${this.redisUrl}`);
  }

  async set<T>(_key: string, _value: T, _ttlSeconds: number): Promise<void> {
    throw new Error(`Redis cache adapter requires a Redis client integration for ${this.redisUrl}`);
  }

  async delete(_key: string): Promise<void> {
    throw new Error(`Redis cache adapter requires a Redis client integration for ${this.redisUrl}`);
  }
}
