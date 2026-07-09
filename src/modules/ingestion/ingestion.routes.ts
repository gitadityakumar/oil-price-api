import type { Router } from '../../core/router/router';
import { IngestionController } from './ingestion.controller';

export function registerIngestionRoutes(router: Router): void {
  const controller = new IngestionController();
  router.post('/v1/internal/ingestion/runs', (ctx) => controller.startRun(ctx));
}
