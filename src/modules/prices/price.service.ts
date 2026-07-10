/**
 * Price service — business logic only. No HTTP types.
 *
 * - Resolves location selectors via LocationService.
 * - Fetches enriched rows from the price repository.
 * - Ranks competing rows per fuel by resolution, reliability, price_kind,
 *   recency, confidence (per Task 5 selection order).
 * - Maps to the Task 4 output schema, attaching PIN resolution details and
 *   optional components.
 */

import {
  findSelectedPricePage,
  findPriceFactByPublicId,
  findComponentsByPublicPriceId,
  findComponentsByPublicPriceIds,
  type EnrichedPriceFactRow,
} from './price.repository';
import { LocationService } from '../locations/location.service';
import {
  mapPrice,
  mapPriceComponents,
} from './price.schema';
import {
  resolutionRank,
  reliabilityRank,
  priceKindRank,
  type PriceLookupInput,
  type PriceHistoryInput,
  type PriceComponentsResult,
  type PriceLookupResult,
  type PriceHistoryResult,
  type ClientContext,
  type Warning,
} from './price.model';
import { AppError } from '../../core/errors/app-error';
import type { PriceSchema } from './price.schema';
import type { ResolvedTarget } from '../locations/location.model';
import type { PriceFactWithProvenance } from './prices.model';
import { getCache } from '../../core/cache/cache';
import { CACHE_TTL_SECONDS, type Cache } from '../../core/cache/cache.model';
import { priceSearchCacheKey } from '../../core/cache/cache-key';
import { FreshnessService } from '../locations/freshness.service';
import { ConfidenceService } from '../locations/confidence.service';
import { getDataGeneration } from '../../core/cache/cache-generation';

const locationService = new LocationService();
const freshnessService = new FreshnessService();
const confidenceService = new ConfidenceService();

type CachedLookup = Pick<PriceLookupResult, 'prices' | 'total' | 'warnings'>;
type CachedHistory = Pick<PriceHistoryResult, 'prices' | 'total' | 'warnings'>;

export class PriceService {
  constructor(private readonly cache: Cache = getCache()) {}

  async getCurrentPrices(input: PriceLookupInput, _ctx: ClientContext): Promise<PriceLookupResult> {
    const generation = await getDataGeneration('prices');
    const cacheKey = priceSearchCacheKey({ operation: 'current', selector: input.location, fuels: input.fuels, date: input.date, includes: input.includes, limit: input.limit, offset: input.offset, generation });
    const cacheRead = await safeGet<CachedLookup>(this.cache, cacheKey);
    if (cacheRead.value) return { ...cacheRead.value, cache: { status: 'HIT', ttl_seconds: await safeTtl(this.cache, cacheKey) } };

    const resolution = await locationService.resolve(input.location);
    const warnings: Warning[] = [...resolution.warnings];
    const targets = resolution.candidates;
    if (targets.length === 0) {
      const empty = { prices: [], total: 0, warnings };
      const stored = await safeSet(this.cache, cacheKey, empty, CACHE_TTL_SECONDS.negativeNoData);
      return { ...empty, cache: { status: cacheRead.failed || !stored ? 'BYPASS' : 'MISS', ttl_seconds: null } };
    }

    const page = await findSelectedPricePage({
      mode: 'current',
      fuelCodes: input.fuels,
      date: input.date,
      targets,
      limit: input.limit,
      offset: input.offset,
    });
    const rows = page.rows;
    let prices = rows.map((row) => toPriceSchema(row, input.location, targets));
    if (input.includes.includes('components')) {
      prices = await attachComponents(prices, rows);
    }
    if (!input.includes.includes('source')) {
      prices = prices.map((p) => ({ ...p, source: stripSource(p.source) }));
    }
    if (!input.includes.includes('outlet')) {
      prices = prices.map((p) => ({ ...p, outlet: null }));
    }

    if (prices.length === 0) {
      warnings.push({ code: 'NO_PRICE_AVAILABLE', message: 'No matching price was found for the requested selector and date.' });
    }
    const result = { prices, total: page.total, warnings };
    const stored = await safeSet(this.cache, cacheKey, result, prices.length > 0 ? CACHE_TTL_SECONDS.searchResult : CACHE_TTL_SECONDS.negativeNoData);
    return { ...result, cache: { status: cacheRead.failed || !stored ? 'BYPASS' : 'MISS', ttl_seconds: null } };
  }

  async getHistoricalPrices(input: PriceHistoryInput, _ctx: ClientContext): Promise<PriceHistoryResult> {
    const generation = await getDataGeneration('prices');
    const cacheKey = priceSearchCacheKey({ operation: 'history', selector: input.location, fuels: [input.fuel], date: `${input.from}:${input.to}`, includes: [], limit: input.limit, offset: input.offset, generation });
    const cacheRead = await safeGet<CachedHistory>(this.cache, cacheKey);
    if (cacheRead.value) return { ...cacheRead.value, cache: { status: 'HIT', ttl_seconds: await safeTtl(this.cache, cacheKey) } };

    const resolution = await locationService.resolve(input.location);
    const warnings: Warning[] = [...resolution.warnings];
    const targets = resolution.candidates;
    if (targets.length === 0) {
      const empty = { prices: [], total: 0, warnings };
      const stored = await safeSet(this.cache, cacheKey, empty, CACHE_TTL_SECONDS.negativeNoData);
      return { ...empty, cache: { status: cacheRead.failed || !stored ? 'BYPASS' : 'MISS', ttl_seconds: null } };
    }

    const page = await findSelectedPricePage({
      mode: 'history',
      fuelCodes: [input.fuel],
      from: input.from,
      to: input.to,
      targets,
      limit: input.limit,
      offset: input.offset,
    });
    const prices = page.rows.map((row) => toPriceSchema(row, input.location, targets));

    if (prices.length === 0) {
      warnings.push({ code: 'NO_PRICE_AVAILABLE', message: 'No matching price was found for the requested selector and date range.' });
    }
    const result = { prices, total: page.total, warnings };
    const stored = await safeSet(this.cache, cacheKey, result, prices.length > 0 ? CACHE_TTL_SECONDS.searchResult : CACHE_TTL_SECONDS.negativeNoData);
    return { ...result, cache: { status: cacheRead.failed || !stored ? 'BYPASS' : 'MISS', ttl_seconds: null } };
  }

  async getPriceComponents(publicPriceId: string): Promise<PriceComponentsResult> {
    const price = await findPriceFactByPublicId(publicPriceId);
    if (!price) {
      throw new AppError('NOT_FOUND', `Price not found: ${publicPriceId}`, 404);
    }
    const components = await findComponentsByPublicPriceId(publicPriceId);
    return {
      components: mapPriceComponents(
        {
          public_id: price.public_id,
          observed_at: price.observed_at,
          raw_hash: price.raw_hash,
          source_key: price.source_key,
          source_name: price.source_name ?? null,
          raw_document_url: price.raw_document_url,
        },
        components,
      ),
    };
  }
}

export function rankAndDedupe(rows: EnrichedPriceFactRow[], _targets: ResolvedTarget[] = [], _location: unknown = null): EnrichedPriceFactRow[] {
  const scored = rows.map((row) => {
    const method = row.matched_target?.resolution_method ?? row.pin_resolution?.method ?? 'city_fallback';
    const observedTs = new Date(row.observed_at).getTime();
    return { row, method, observedTs };
  });
  scored.sort((a, b) => {
    const resolution = resolutionRank(a.method) - resolutionRank(b.method);
    if (resolution !== 0) return resolution;
    const reliability = reliabilityRank(a.row.reliability_tier) - reliabilityRank(b.row.reliability_tier);
    if (reliability !== 0) return reliability;
    const kind = priceKindRank(a.row.price_kind) - priceKindRank(b.row.price_kind);
    if (kind !== 0) return kind;
    if (a.observedTs !== b.observedTs) return b.observedTs - a.observedTs;
    const confidence = Number(b.row.confidence_score ?? 0) - Number(a.row.confidence_score ?? 0);
    if (confidence !== 0) return confidence;
    return a.row.public_id.localeCompare(b.row.public_id);
  });
  // Best row per (fuel_code, location key) to avoid duplicates.
  const seen = new Set<string>();
  const out: EnrichedPriceFactRow[] = [];
  for (const s of scored) {
    const key = `${s.row.fuel_code ?? 'unknown'}|${s.row.applicable_date}|${s.row.geography_id ?? ''}|${s.row.outlet_id ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.row);
  }
  return out;
}

function toPriceSchema(row: EnrichedPriceFactRow, location: PriceLookupInput['location'], targets: ResolvedTarget[]): PriceSchema {
  const target = row.matched_target ?? matchTarget(row, targets);
  const method = target?.resolution_method ?? row.pin_resolution?.method ?? 'city_fallback';
  const hasComponentsHint = row.has_components ?? Boolean(row.components && row.components.length > 0);
  const enriched: PriceFactWithProvenance = {
    ...row,
    confidence_score: String(confidenceService.score({
      reliabilityTier: row.reliability_tier,
      method,
      applicableDate: row.applicable_date,
      observedAt: row.observed_at,
      effectiveAt: row.effective_at,
      resolutionModifier: target?.confidence_modifier,
      hasComponents: hasComponentsHint,
    })),
    freshness_badge: freshnessService.buildBadge({
      sourceType: row.source_type,
      reliabilityTier: row.reliability_tier,
      applicableDate: row.applicable_date,
      effectiveAt: row.effective_at,
      observedAt: row.observed_at,
    }),
    pin_resolution: target
      ? {
          pincode: location.type === 'pin' ? location.pin : (row.geo?.pincode ?? ''),
          method: target.resolution_method,
          priority_rank: target.priority_rank,
          direct_from_source: target.direct_from_source,
          derived: target.derived,
          input_type: location.type,
          input_value: selectorValue(location),
          geography_id: target.geography_id,
          outlet_id: target.outlet_id,
        }
      : row.pin_resolution ?? null,
  };
  return mapPrice(enriched);
}

function matchTarget(row: EnrichedPriceFactRow, targets: ResolvedTarget[]): ResolvedTarget | null {
  if (row.outlet_id !== null) {
    const t = targets.find((x) => x.outlet_id === row.outlet_id);
    if (t) return t;
  }
  if (row.geography_id !== null) {
    const t = targets.find((x) => x.outlet_id === null && x.geography_id === row.geography_id);
    if (t) return t;
  }
  return null;
}

function selectorValue(location: PriceLookupInput['location']): string {
  switch (location.type) {
    case 'pin': return location.pin;
    case 'city_state': return `${location.city},${location.state}`;
    case 'state': return location.state;
    case 'outlet_id': return location.outlet_id;
  }
}

async function attachComponents(prices: PriceSchema[], rows: EnrichedPriceFactRow[]): Promise<PriceSchema[]> {
  const grouped = await findComponentsByPublicPriceIds(rows.map((row) => row.public_id));
  return prices.map((price, index) => {
    const row = rows[index];
    if (!row) return price;
    const mapped = mapPriceComponents(
      { public_id: row.public_id, observed_at: row.observed_at, raw_hash: row.raw_hash, source_key: row.source_key, source_name: row.source_name ?? null, raw_document_url: row.raw_document_url },
      grouped.get(row.public_id) ?? [],
    );
    return { ...price, components: mapped.components } as PriceSchema & { components: typeof mapped.components };
  });
}

function stripSource(source: PriceSchema['source']): PriceSchema['source'] {
  // include=source not requested: keep only minimal identifiers.
  return { ...source, attribution: null, document_url: null };
}

async function safeGet<T>(cache: Cache, key: string): Promise<{ value: T | null; failed: boolean }> {
  try { return { value: await cache.get<T>(key), failed: false }; } catch { return { value: null, failed: true }; }
}

async function safeSet<T>(cache: Cache, key: string, value: T, ttl: number): Promise<boolean> {
  try { await cache.set(key, value, ttl); return true; } catch { return false; }
}

async function safeTtl(cache: Cache, key: string): Promise<number | null> {
  try { return await cache.ttl(key); } catch { return null; }
}
