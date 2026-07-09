/**
 * Minimal validation primitives used by controllers/services.
 * Avoids adding a schema library until a later task requires it.
 */

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

export function parseQueryInt(value: string | string[] | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}