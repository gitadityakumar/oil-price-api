/**
 * Public health service boundary. Returns minimal process health with no
 * secrets (DB URLs, env values, dependency versions).
 */

export interface PublicHealthSummary {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  time: string;
}

export const SERVICE_NAME = 'indian-fuel-price-api';
export const SERVICE_VERSION = '1.0.0';

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