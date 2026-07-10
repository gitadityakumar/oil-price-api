/**
 * Public health service boundary. Returns minimal process health with no
 * secrets (DB URLs, env values, dependency versions).
 */

import { SERVICE_VERSION } from '../../version';

export interface PublicHealthSummary {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  time: string;
}

export const SERVICE_NAME = 'indian-fuel-price-api';
export { SERVICE_VERSION };

export class HealthService {
  async getHealth(): Promise<PublicHealthSummary> {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      time: new Date().toISOString(),
    };
  }
}
