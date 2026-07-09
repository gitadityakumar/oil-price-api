import type { Router } from '../../core/router/router';
import { PriceController } from './price.controller';

export function registerPriceRoutes(router: Router): void {
  const controller = new PriceController();
  const readPublic = { auth: 'api_key', scopes: ['read:public'], rateLimit: true } as const;
  router.get('/v1/prices', (ctx) => controller.getPrices(ctx), readPublic);
  router.get('/v1/prices/history', (ctx) => controller.getPriceHistory(ctx), readPublic);
  router.get('/v1/prices/:id/components', (ctx) => controller.getPriceComponents(ctx), readPublic);
}
