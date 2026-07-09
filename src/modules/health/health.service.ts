import type { HealthSummary } from './health.model';

/** Health service boundary (no HTTP). Real DB/cache probes come in Task 6. */
export class HealthService {
  async getHealth(): Promise<HealthSummary> {
    return {
      status: 'ok',
      checks: [
        { name: 'server', status: 'ok' },
      ],
      time: new Date().toISOString(),
    };
  }
}