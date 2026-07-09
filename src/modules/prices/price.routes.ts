import type { Router } from '../../core/router/router';
import { PriceController } from './price.controller';

export function registerPriceRoutes(router: Router): void {
  const controller = new PriceController();
  router.get('/v1/prices', (ctx) => controller.getPrices(ctx));
  router.get('/v1/prices/history', (ctx) => controller.getPriceHistory(ctx));
  router.get('/v1/prices/:id/components', (ctx) => controller.getPriceComponents(ctx));
}