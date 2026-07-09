import type { Router } from '../../core/router/router';
import { SourceController } from './source.controller';

export function registerSourceRoutes(router: Router): void {
  const controller = new SourceController();
  router.get('/v1/sources', (ctx) => controller.listSources(ctx));
  router.get('/v1/sources/:id', (ctx) => controller.getSource(ctx));
  router.get('/v1/internal/sources/health', (ctx) => controller.getSourceHealth(ctx));
  router.get('/v1/internal/crawl-runs', (ctx) => controller.listCrawlRuns(ctx));
}