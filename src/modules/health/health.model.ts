/**
 * Health module domain + persistence types.
 *
 * Health checks are runtime probes (DB, cache, ingestion staleness), not
 * persisted dimension rows. Types here describe the probe results exposed by
 * the health endpoints.
 */

export type HealthStatus = 'ok' | 'degraded' | 'down';

export type HealthCheckResult = {
  name: string;
  status: HealthStatus;
  latency_ms?: number;
  message?: string;
  details?: Record<string, unknown>;
};

export type HealthSummary = {
  status: HealthStatus;
  checks: HealthCheckResult[];
  version?: string;
  time: string;
};