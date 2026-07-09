import type { Router } from '../../core/router/router';
import { stubController } from '../_shared/stub.controller';

export function registerSourcesRoutes(router: Router): void {
  router.get('/v1/sources', stubController('GET /v1/sources'));
  router.get('/v1/sources/:id', stubController('GET /v1/sources/:id'));
  router.get('/v1/coverage', stubController('GET /v1/coverage'));
  router.get('/v1/internal/sources/health', stubController('GET /v1/internal/sources/health'));
  router.get('/v1/internal/crawl-runs', stubController('GET /v1/internal/crawl-runs'));
  router.post('/v1/internal/ingestion/runs', stubController('POST /v1/internal/ingestion/runs'));
}