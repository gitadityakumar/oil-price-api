export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS' | 'STALE_REVALIDATED';

export interface CacheMeta {
  status: CacheStatus;
  ttl_seconds: number | null;
}

export const CACHE_TTL_SECONDS = {
  searchResult: 60 * 60,
  pinResolution: 24 * 60 * 60,
  sourceHealth: 5 * 60,
  dailyPriceFinalized: 24 * 60 * 60,
  negativeNoData: 5 * 60,
} as const;
