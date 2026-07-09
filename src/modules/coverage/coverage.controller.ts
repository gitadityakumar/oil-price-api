/**
 * Coverage controller — HTTP only.
 */

import type { HttpContext } from '../../core/http/context';
import { ok, error } from '../../core/http/response';
import { AppError } from '../../core/errors/app-error';
import { CoverageService } from './coverage.service';

export class CoverageController {
  constructor(private readonly service: CoverageService = new CoverageService()) {}

  async getCoverage(ctx: HttpContext): Promise<void> {
    try {
      const q = ctx.query;
      const rows = await this.service.getCoverage({
        fuel: q.get('fuel') ?? undefined,
        state: q.get('state') ?? undefined,
        source_type: q.get('source_type') ?? undefined,
      });
      ok(ctx, rows);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }
}