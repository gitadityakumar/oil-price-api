import type { Router } from '../../core/router/router';
import { SourceController } from './source.controller';

export function registerSourceRoutes(router: Router): void {
  const controller = new SourceController();
  const readPublic = { auth: 'api_key', scopes: ['read:public'], rateLimit: true } as const;
  const readInternal = { auth: 'api_key', scopes: ['read:internal'], rateLimit: true } as const;
  router.get('/v1/sources', (ctx) => controller.listSources(ctx), readPublic);
  router.get('/v1/sources/:id', (ctx) => controller.getSource(ctx), readPublic);
  router.get('/v1/internal/sources/health', (ctx) => controller.getSourceHealth(ctx), readInternal);
  router.get('/v1/internal/crawl-runs', (ctx) => controller.listCrawlRuns(ctx), readInternal);
}
