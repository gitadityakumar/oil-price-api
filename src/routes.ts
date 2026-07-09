import { Router } from './core/router/router';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerPriceRoutes } from './modules/prices/price.routes';
import { registerStationRoutes } from './modules/stations/station.routes';
import { registerSourceRoutes } from './modules/sources/source.routes';
import { registerCoverageRoutes } from './modules/coverage/coverage.routes';
import { registerIngestionRoutes } from './modules/ingestion/ingestion.routes';

/**
 * Central route registration. Each register* function only maps HTTP method/path
 * to controller handlers; no business logic here.
 */
export function buildRouter(): Router {
  const router = new Router();
  registerHealthRoutes(router);
  registerPriceRoutes(router);
  registerStationRoutes(router);
  registerSourceRoutes(router);
  registerCoverageRoutes(router);
  registerIngestionRoutes(router);

  return router;
}
