import { getCache } from '../../core/cache/cache';
import { CACHE_TTL_SECONDS } from '../../core/cache/cache.model';
import { pinResolutionCacheKey } from '../../core/cache/cache-key';
import { getDataGeneration } from '../../core/cache/cache-generation';
import type { ResolvedLocationTarget } from './location.model';
import {
  findDirectStationPinTargets,
  findConfiguredPinTargets,
  findCityFallbackTargets,
} from './pincode-resolution.repository';

export class PincodeResolutionService {
  async resolvePin(pin: string): Promise<ResolvedLocationTarget[]> {
    const cache = getCache();
    const generation = await getDataGeneration('prices');
    const key = `${pinResolutionCacheKey(pin)}:g${generation}`;
    const cached = await safeGet<ResolvedLocationTarget[]>(cache, key);
    if (cached) return cached;

    const direct = await findDirectStationPinTargets(pin);
    const configured = await findConfiguredPinTargets(pin);
    const fallback = await findCityFallbackTargets(pin);

    const merged = mergeTargets([...direct, ...configured, ...fallback]);
    await safeSet(cache, key, merged, CACHE_TTL_SECONDS.pinResolution);
    return merged;
  }
}

function mergeTargets(targets: ResolvedLocationTarget[]): ResolvedLocationTarget[] {
  const byKey = new Map<string, ResolvedLocationTarget>();
  for (const target of targets) {
    const key = `${target.method}|${target.priorityRank}|${target.inputValue}`;
    const existing = byKey.get(key) ?? { ...target, geographyIds: [], outletIds: [] };
    for (const id of target.geographyIds) if (!existing.geographyIds.includes(id)) existing.geographyIds.push(id);
    for (const id of target.outletIds) if (!existing.outletIds.includes(id)) existing.outletIds.push(id);
    byKey.set(key, existing);
  }
  return [...byKey.values()].sort((a, b) => a.priorityRank - b.priorityRank);
}

async function safeGet<T>(cache: ReturnType<typeof getCache>, key: string): Promise<T | null> {
  try { return await cache.get<T>(key); } catch { return null; }
}

async function safeSet<T>(cache: ReturnType<typeof getCache>, key: string, value: T, ttl: number): Promise<void> {
  try { await cache.set(key, value, ttl); } catch { /* cache is best-effort */ }
}
