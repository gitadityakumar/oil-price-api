/**
 * Station controller — HTTP only. Parses query/path, validates, delegates to
 * StationService and PriceService, writes the standardized envelope. No SQL.
 */

import type { HttpContext } from '../../core/http/context';
import { ok, okPaginated, error } from '../../core/http/response';
import { AppError } from '../../core/errors/app-error';
import { buildPagination } from '../../core/http/pagination';
import {
  validatePin,
  validateFuels,
  resolvePagination,
  validateIsoDate,
} from '../../core/validation/query';
import { StationService } from './station.service';
import { PriceService } from '../prices/price.service';
import { todayInKolkata } from '../prices/price.validation';
import type { FuelCode } from '../prices/prices.model';
import type { PriceInclude } from '../prices/price.model';

const OPERATOR_ONLY = new Set(['pin', 'city', 'state', 'operator', 'fuel']);

export class StationController {
  constructor(
    private readonly stations: StationService = new StationService(),
    private readonly prices: PriceService = new PriceService(),
  ) {}

  async listStations(ctx: HttpContext): Promise<void> {
    try {
      const filters = parseStationFilters(ctx);
      const result = await this.stations.listStations(filters);
      const pagination = buildPagination({ limit: filters.limit, offset: filters.offset, total: result.total });
      okPaginated(ctx, result.stations, pagination);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }

  async getStation(ctx: HttpContext): Promise<void> {
    const id = ctx.params['id'] ?? '';
    try {
      const station = await this.stations.getStation(id);
      ok(ctx, station);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }

  async getStationPrices(ctx: HttpContext): Promise<void> {
    const id = ctx.params['id'] ?? '';
    try {
      const [station, parsedFuel, parsedDate, parsedIncludes, parsedPaging] = parseStationPricesQuery(ctx);
      // Sanity check: outlet must exist.
      await this.stations.getStation(station);
      const result = await this.prices.getCurrentPrices(
        {
          location: { type: 'outlet_id', outlet_id: id },
          fuels: parsedFuel,
          date: parsedDate,
          includes: parsedIncludes,
          limit: parsedPaging.limit,
          offset: parsedPaging.offset,
        },
        { requestId: ctx.requestId },
      );
      const pagination = buildPagination({ limit: parsedPaging.limit, offset: parsedPaging.offset, total: result.total });
      okPaginated(ctx, result.prices, pagination, 200, {
        cache: result.cache,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
      });
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }
}

function parseStationFilters(ctx: HttpContext) {
  const q = ctx.query;
  const pin = q.get('pin') ?? undefined;
  const city = q.get('city') ?? undefined;
  const state = q.get('state') ?? undefined;
  const operator = q.get('operator') ?? undefined;
  const fuelRaw = q.get('fuel') ?? undefined;

  if (!pin && !city && !state && !operator && !fuelRaw) {
    throw new AppError('VALIDATION_ERROR', 'At least one of pin, city, state, operator, or fuel is required.', 400, [
      { field: 'filters', reason: 'A filter is required to avoid table scans.' },
    ]);
  }
  // Reject unknown params? Keep permissive but ignore non-documented.
  for (const key of q.keys()) {
    if (!OPERATOR_ONLY.has(key) && !['limit', 'offset'].includes(key)) {
      throw new AppError('VALIDATION_ERROR', `Unsupported query parameter: ${key}`, 400, [
        { field: key, reason: 'Not supported.' },
      ]);
    }
  }

  let fuel;
  if (fuelRaw) {
    const fuels = validateFuels([fuelRaw]);
    fuel = fuels[0];
  }
  const { limit, offset } = resolvePagination(q, 100);
  return {
    pin: pin ? validatePin(pin) : undefined,
    city,
    state,
    operator,
    fuel,
    limit,
    offset,
  };
}

function parseStationPricesQuery(ctx: HttpContext): [string, FuelCode[], string, PriceInclude[], { limit: number; offset: number }] {
  const id = ctx.params['id'] ?? '';
  if (!id) throw new AppError('VALIDATION_ERROR', 'Station id is required.', 400, [{ field: 'id', reason: 'Required.' }]);
  const q = ctx.query;
  const fuelRaw = q.get('fuel')?.split(',').map((s) => s.trim()).filter(Boolean);
  const fuels = validateFuels(fuelRaw);
  const date = validateIsoDate(q.get('date') ?? undefined, 'date') ?? todayInKolkata();
  const includesRaw = q.get('include')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const allowed = new Set(['components', 'outlet', 'source']);
  const invalid = includesRaw.filter((v) => !allowed.has(v));
  if (invalid.length > 0) {
    throw new AppError('VALIDATION_ERROR', `Invalid include values: ${invalid.join(', ')}`, 400, [
      { field: 'include', reason: 'Allowed: components, outlet, source.' },
    ]);
  }
  const { limit, offset } = resolvePagination(q, 100);
  return [id, fuels, date, includesRaw as PriceInclude[], { limit, offset }];
}
