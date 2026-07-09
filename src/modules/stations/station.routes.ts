import type { Router } from '../../core/router/router';
import { StationController } from './station.controller';

export function registerStationRoutes(router: Router): void {
  const controller = new StationController();
  router.get('/v1/stations', (ctx) => controller.listStations(ctx));
  router.get('/v1/stations/:id', (ctx) => controller.getStation(ctx));
  router.get('/v1/stations/:id/prices', (ctx) => controller.getStationPrices(ctx));
}