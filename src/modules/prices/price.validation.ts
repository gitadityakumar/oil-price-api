/**
 * Price endpoint query validation. Built on the shared validation helpers from
 * Task 4; throws AppError(VALIDATION_ERROR) with field details.
 */

import {
  resolveLocationSelector,
  validateFuels,
  validateIncludes,
  validateIsoDate,
  validateDateRange,
  resolvePagination,
  FUEL_CODES,
  type FuelCode,
} from '../../core/validation/query';
import type {
  PriceLookupInput,
  PriceHistoryInput,
  LocationInput,
  PriceInclude,
} from './price.model';
import { AppError } from '../../core/errors/app-error';

const MVP_DEFAULT_FUELS: FuelCode[] = ['PETROL', 'DIESEL', 'CNG', 'PNG'];

export function todayInKolkata(): string {
  // Asia/Kolkata is UTC+5:30 with no DST.
  const now = new Date();
  const utcMs = now.getTime();
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(utcMs + offsetMs);
  return ist.toISOString().slice(0, 10);
}

export interface RawCurrentPriceQuery {
  query: URLSearchParams;
}

export function parseCurrentPricesQuery(query: URLSearchParams): PriceLookupInput {
  const selector = resolveLocationSelector(query);
  const location: LocationInput = selectorToLocation(selector);
  const fuelsRaw = query.get('fuel')?.split(',').map((s) => s.trim()).filter(Boolean);
  const fuels: FuelCode[] = fuelsRaw && fuelsRaw.length > 0 ? validateFuels(fuelsRaw) : MVP_DEFAULT_FUELS;
  const dateStr = query.get('date') ?? undefined;
  const date = validateIsoDate(dateStr, 'date') ?? todayInKolkata();
  const includes = validateIncludes(
    query.get('include')?.split(',').map((s) => s.trim()).filter(Boolean),
  ) as PriceInclude[];
  const { limit, offset } = resolvePagination(query, 100);

  return { location, fuels, date, includes, limit, offset };
}

export function parseHistoryQuery(query: URLSearchParams): PriceHistoryInput {
  const selector = resolveLocationSelector(query);
  const location: LocationInput = selectorToLocation(selector);
  const fuelRaw = query.get('fuel');
  if (!fuelRaw) throw new AppError('VALIDATION_ERROR', 'fuel is required (a single fuel for MVP).', 400, [{ field: 'fuel', reason: 'Required.' }]);
  const fuels = validateFuels([fuelRaw.trim()]);
  if (fuels.length !== 1) {
    throw new AppError('VALIDATION_ERROR', 'fuel must be a single code for MVP.', 400, [{ field: 'fuel', reason: 'A single fuel code is required.' }]);
  }
  const from = validateIsoDate(query.get('from') ?? undefined, 'from', true)!;
  const to = validateIsoDate(query.get('to') ?? undefined, 'to', true)!;
  validateDateRange(from, to, 366);
  const { limit, offset } = resolvePagination(query, 100);
  return { location, fuel: fuels[0], from, to, limit, offset };
}

export function validatePriceId(id: string): string {
  if (!id.startsWith('price_')) {
    throw new AppError('VALIDATION_ERROR', 'Price id must start with "price_".', 400, [{ field: 'id', reason: 'Must start with "price_".' }]);
  }
  return id;
}

function selectorToLocation(selector: ReturnType<typeof resolveLocationSelector>): LocationInput {
  switch (selector.type) {
    case 'pin': return { type: 'pin', pin: selector.pin! };
    case 'city_state': return { type: 'city_state', city: selector.city!, state: selector.state! };
    case 'state': return { type: 'state', state: selector.state! };
    case 'outlet_id': return { type: 'outlet_id', outlet_id: selector.outlet_id! };
  }
}

export { FUEL_CODES };