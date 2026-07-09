import type { Router } from '../../core/router/router';
import { HealthController } from './health.controller';

export function registerHealthRoutes(router: Router): void {
  const controller = new HealthController();
  router.get('/v1/health', (ctx) => controller.health(ctx));
}