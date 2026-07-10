import { createHash } from 'node:crypto';

export function sha256Short(value: unknown): string {
  const normalized = typeof value === 'string' ? value : stableStringify(value);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

export function dailyPriceCacheKey(input: {
  sourceKey: string;
  targetType: string;
  targetId: string | number;
  fuelCode: string;
  applicableDate: string;
}): string {
  return `price:daily:${input.sourceKey}:${input.targetType}:${input.targetId}:${input.fuelCode}:${input.applicableDate}`;
}

export function priceSearchCacheKey(input: {
  operation?: 'current' | 'history';
  selector: unknown;
  fuels: string[];
  date: string;
  includes: string[];
  limit?: number;
  offset?: number;
  generation?: number;
}): string {
  const selectorHash = sha256Short(input.selector);
  const fuelHash = sha256Short([...input.fuels].sort());
  const includeHash = sha256Short([...input.includes].sort());
  return `price:search:v2:${input.operation ?? 'current'}:${selectorHash}:${fuelHash}:${input.date}:${includeHash}:${input.limit ?? 0}:${input.offset ?? 0}:g${input.generation ?? 1}`;
}

export function pinResolutionCacheKey(pin: string): string {
  return `location:pin:v1:${pin}`;
}

export function sourceHealthCacheKey(sourceKeyOrAll: string = 'all'): string {
  return `source:health:v1:${sourceKeyOrAll}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
