/**
 * Pagination helpers. Controllers compute counts from the repository result;
 * these helpers shape the pagination meta uniformly across endpoints.
 */

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationInput {
  limit: number;
  offset: number;
  total: number;
}

export interface PaginationOutput {
  limit: number;
  offset: number;
  next_offset: number | null;
  total: number;
}

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
export const MAX_INTERNAL_LIMIT = 1000;

/** Clamp limit/offset to safe bounds for public endpoints. */
export function clampPagination(limit: unknown, offset: unknown, max = MAX_LIMIT): PaginationParams {
  const lim = toInt(limit, DEFAULT_LIMIT);
  const off = toInt(offset, 0);
  return {
    limit: Math.min(Math.max(lim, 1), max),
    offset: Math.max(off, 0),
  };
}

/** Build the pagination meta block, with next_offset null at the end. */
export function buildPagination(input: PaginationInput): PaginationOutput {
  const { limit, offset, total } = input;
  const nextOffset = offset + limit;
  const next_offset = nextOffset < total ? nextOffset : null;
  return { limit, offset, next_offset, total };
}

function toInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : fallback;
}