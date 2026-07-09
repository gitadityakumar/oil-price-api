/**
 * Price controller — HTTP only. Parses query/path, validates, calls the
 * service, and writes the standardized envelope. Never executes SQL.
 */

import type { HttpContext } from '../../core/http/context';
import { ok, okPaginated, error } from '../../core/http/response';
import { AppError } from '../../core/errors/app-error';
import {
  parseCurrentPricesQuery,
  parseHistoryQuery,
  validatePriceId,
} from './price.validation';
import { PriceService } from './price.service';
import { buildPagination } from '../../core/http/pagination';

export class PriceController {
  constructor(private readonly service: PriceService = new PriceService()) {}

  async getPrices(ctx: HttpContext): Promise<void> {
    let input;
    try {
      input = parseCurrentPricesQuery(ctx.query);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
      return;
    }
    const result = await this.service.getCurrentPrices(input, { requestId: ctx.requestId });
    const pagination = buildPagination({ limit: input.limit, offset: input.offset, total: result.total });
    okPaginated(ctx, result.prices, pagination, 200, {
      cache: { status: 'BYPASS', ttl_seconds: null },
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    });
  }

  async getPriceHistory(ctx: HttpContext): Promise<void> {
    let input;
    try {
      input = parseHistoryQuery(ctx.query);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
      return;
    }
    const result = await this.service.getHistoricalPrices(input, { requestId: ctx.requestId });
    const pagination = buildPagination({ limit: input.limit, offset: input.offset, total: result.total });
    okPaginated(ctx, result.prices, pagination, 200, {
      cache: { status: 'BYPASS', ttl_seconds: null },
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    });
  }

  async getPriceComponents(ctx: HttpContext): Promise<void> {
    const id = ctx.params['id'] ?? '';
    try {
      validatePriceId(id);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
      return;
    }
    try {
      const result = await this.service.getPriceComponents(id);
      ok(ctx, result.components);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }
}