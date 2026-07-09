import type { Router } from '../../core/router/router';
import { StationController } from './station.controller';

export function registerStationRoutes(router: Router): void {
  const controller = new StationController();
  const readPublic = { auth: 'api_key', scopes: ['read:public'], rateLimit: true } as const;
  router.get('/v1/stations', (ctx) => controller.listStations(ctx), readPublic);
  router.get('/v1/stations/:id', (ctx) => controller.getStation(ctx), readPublic);
  router.get('/v1/stations/:id/prices', (ctx) => controller.getStationPrices(ctx), readPublic);
}
