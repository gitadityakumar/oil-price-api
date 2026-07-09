import type { Router } from '../../core/router/router';
import { CoverageController } from './coverage.controller';

export function registerCoverageRoutes(router: Router): void {
  const controller = new CoverageController();
  router.get('/v1/coverage', (ctx) => controller.getCoverage(ctx), {
    auth: 'api_key',
    scopes: ['read:public'],
    rateLimit: true,
  });
}
