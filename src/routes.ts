import { Router } from './core/router/router';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerPricesRoutes } from './modules/prices/prices.routes';
import { registerStationsRoutes } from './modules/stations/stations.routes';
import { registerSourcesRoutes } from './modules/sources/sources.routes';

/**
 * Central route registration. Each register* function only maps HTTP method/path
 * to controller handlers; no business logic here.
 */
export function buildRouter(): Router {
  const router = new Router();
  registerHealthRoutes(router);
  registerPricesRoutes(router);
  registerStationsRoutes(router);
  registerSourcesRoutes(router);
  return router;
}