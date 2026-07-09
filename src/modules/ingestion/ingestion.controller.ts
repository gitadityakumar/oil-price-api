import type { HttpContext } from '../../core/http/context';
import { ok, error } from '../../core/http/response';
import { AppError } from '../../core/errors/app-error';
import { IngestionService } from './ingestion.service';

export class IngestionController {
  constructor(private readonly service: IngestionService = new IngestionService()) {}

  async startRun(ctx: HttpContext): Promise<void> {
    try {
      const body = (ctx.body ?? {}) as Record<string, unknown>;
      const source_key = typeof body.source_key === 'string' ? body.source_key : '';
      const mode = typeof body.mode === 'string' ? body.mode : 'manual';
      const reason = typeof body.reason === 'string' ? body.reason : undefined;
      if (!source_key) {
        throw new AppError('VALIDATION_ERROR', 'source_key is required.', 400, [{ field: 'source_key', reason: 'Required.' }]);
      }
      if (mode !== 'manual') {
        throw new AppError('VALIDATION_ERROR', 'mode must be "manual" for this endpoint.', 400, [{ field: 'mode', reason: 'Only manual supported.' }]);
      }
      const result = await this.service.startManualRun({ source_key, mode: 'manual', reason });
      ok(ctx, result, 202);
    } catch (e) {
      error(ctx, e instanceof AppError ? e : AppError.fromUnknown(e));
    }
  }
}
