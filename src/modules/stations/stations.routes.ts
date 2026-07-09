import type { Router } from '../../core/router/router';
import { stubController } from '../_shared/stub.controller';

export function registerStationsRoutes(router: Router): void {
  router.get('/v1/stations', stubController('GET /v1/stations'));
  router.get('/v1/stations/:id', stubController('GET /v1/stations/:id'));
  router.get('/v1/stations/:id/prices', stubController('GET /v1/stations/:id/prices'));
}