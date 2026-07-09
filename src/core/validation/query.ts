/**
 * Query-string validation helpers shared by controllers. Each helper either
 * returns the parsed value or throws an AppError(VALIDATION_ERROR) with field
 * details suitable for the error envelope.
 */

import { AppError } from '../errors/app-error';
import type { ErrorDetailLike } from './error-details';

export interface LocationSelector {
  type: 'pin' | 'city_state' | 'state' | 'outlet_id';
  pin?: string;
  city?: string;
  state?: string;
  outlet_id?: string;
}

export const FUEL_CODES = ['PETROL', 'DIESEL', 'CNG', 'PNG', 'LNG', 'LPG'] as const;
export type FuelCode = (typeof FUEL_CODES)[number];

export const PRICE_INCLUDES = ['components', 'outlet', 'source'] as const;
export type PriceInclude = (typeof PRICE_INCLUDES)[number];

const PIN_RE = /^\d{6}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Read a single string value from URLSearchParams (first match). */
export function getString(query: URLSearchParams, name: string): string | undefined {
  const v = query.get(name);
  return v === null ? undefined : v;
}

/** Read a comma-separated list, trimmed and uppercased (for fuels). */
export function getStringList(query: URLSearchParams, name: string, opts?: { uppercase?: boolean; trim?: boolean }): string[] | undefined {
  const v = query.get(name);
  if (v === null || v === '') return undefined;
  const items = v.split(',').map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return undefined;
  if (opts?.uppercase) return items.map((s) => s.toUpperCase());
  return items;
}

/** Validate an India Post PIN code (exactly six digits). */
export function validatePin(pin: string): string {
  if (!PIN_RE.test(pin)) {
    throw validationError('pin', 'Must be a 6 digit India Post PIN code.');
  }
  return pin;
}

/** Validate one or more fuel codes; returns uppercase list. */
export function validateFuels(value: string[] | undefined, fallback?: FuelCode[]): FuelCode[] {
  if (!value || value.length === 0) return fallback ? [...fallback] : [...FUEL_CODES];
  const normalized = value.map((f) => f.toUpperCase());
  const invalid = normalized.filter((f) => !FUEL_CODES.includes(f as FuelCode));
  if (invalid.length > 0) {
    throw validationError('fuel', `Invalid fuel codes: ${invalid.join(', ')}. Allowed: ${FUEL_CODES.join(', ')}.`);
  }
  return normalized as FuelCode[];
}

/** Validate a comma-separated include list against the documented allowlist. */
export function validateIncludes(value: string[] | undefined): PriceInclude[] {
  if (!value || value.length === 0) return [];
  const invalid = value.filter((v) => !PRICE_INCLUDES.includes(v as PriceInclude));
  if (invalid.length > 0) {
    throw validationError('include', `Invalid include values: ${invalid.join(', ')}. Allowed: ${PRICE_INCLUDES.join(', ')}.`);
  }
  return value as PriceInclude[];
}

/** Validate an ISO date string (YYYY-MM-DD); returns as-is on success. */
export function validateIsoDate(value: string | undefined, field: string, required?: boolean): string | undefined {
  if (value === undefined || value === '') {
    if (required) throw validationError(field, 'Date is required as YYYY-MM-DD.');
    return undefined;
  }
  if (!ISO_DATE_RE.test(value) || !isValidDate(value)) {
    throw validationError(field, 'Must be a valid ISO date YYYY-MM-DD.');
  }
  return value;
}

/** Validate a date range, returning { from, to }. Enforces ordering and max span. */
export function validateDateRange(from: string, to: string, maxDays = 366): { from: string; to: string } {
  if (!ISO_DATE_RE.test(from) || !isValidDate(from)) {
    throw validationError('from', 'Must be a valid ISO date YYYY-MM-DD.');
  }
  if (!ISO_DATE_RE.test(to) || !isValidDate(to)) {
    throw validationError('to', 'Must be a valid ISO date YYYY-MM-DD.');
  }
  const f = new Date(from + 'T00:00:00Z').getTime();
  const t = new Date(to + 'T00:00:00Z').getTime();
  if (t < f) throw validationError('to', 'End date must not precede the start date.');
  const spanDays = Math.round((t - f) / 86_400_000) + 1;
  if (spanDays > maxDays) {
    throw validationError('to', `Date range cannot exceed ${maxDays} days.`);
  }
  return { from, to };
}

/**
 * Resolve the location selector. Exactly one of the documented selectors is
 * required; throws VALIDATION_ERROR when zero or more than one is supplied.
 */
export function resolveLocationSelector(query: URLSearchParams): LocationSelector {
  const pin = query.get('pin') ?? undefined;
  const city = query.get('city') ?? undefined;
  const state = query.get('state') ?? undefined;
  const outletId = query.get('outlet_id') ?? undefined;

  const selectors: LocationSelector[] = [];
  if (pin) selectors.push({ type: 'pin', pin: validatePin(pin) });
  if (city && state) {
    selectors.push({ type: 'city_state', city, state });
  } else if (city || state) {
    // Exactly one of city/state provided without the other.
    if (city) throw validationError('state', 'state is required together with city for the city+state selector.');
    // Only state provided: valid state-only selector.
    selectors.push({ type: 'state', state: state as string });
  }
  if (outletId) selectors.push({ type: 'outlet_id', outlet_id: outletId });

  if (selectors.length === 0) {
    throw validationError(
      'location',
      'Exactly one location selector is required: pin, city/state, state, or outlet_id.',
    );
  }
  if (selectors.length > 1) {
    throw validationError('location', 'Provide exactly one location selector, not multiple.');
  }
  return selectors[0];
}

/** Parse and clamp limit/offset. */
export function resolvePagination(query: URLSearchParams, maxLimit = 100): { limit: number; offset: number } {
  const limit = parseIntOr(query.get('limit'), 50);
  const offset = parseIntOr(query.get('offset'), 0);
  return {
    limit: Math.min(Math.max(limit, 1), maxLimit),
    offset: Math.max(offset, 0),
  };
}

function parseIntOr(value: string | null, fallback: number): number {
  if (value === null || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function isValidDate(s: string): boolean {
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime());
}

function validationError(field: string, reason: string): AppError {
  const details: ErrorDetailLike[] = [{ field, reason }];
  return new AppError('VALIDATION_ERROR', reason, 400, details);
}