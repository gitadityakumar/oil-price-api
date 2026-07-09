import type { Router } from '../../core/router/router';
import { stubController } from '../_shared/stub.controller';

export function registerPricesRoutes(router: Router): void {
  router.get('/v1/prices', stubController('GET /v1/prices'));
  router.get('/v1/prices/history', stubController('GET /v1/prices/history'));
  router.get('/v1/prices/:id/components', stubController('GET /v1/prices/:id/components'));
}