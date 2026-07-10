export type MetricLabels = Record<string, string | number | boolean | null | undefined>;

type CounterKey = string;

export class MetricsRegistry {
  private counters = new Map<CounterKey, number>();
  private durationBuckets = new Map<CounterKey, number>();
  private gauges = new Map<CounterKey, number>();
  private droppedSeries = 0;

  constructor(private readonly maxSeriesPerMetricType = 10_000) {}

  increment(name: string, labels: MetricLabels = {}, amount = 1): void {
    const key = metricKey(name, labels);
    this.setWithLimit(this.counters, key, (this.counters.get(key) ?? 0) + amount);
  }

  observeDuration(name: string, durationMs: number, labels: MetricLabels = {}): void {
    const bucket = bucketDuration(durationMs);
    const key = metricKey(name, { ...labels, bucket });
    this.setWithLimit(this.durationBuckets, key, (this.durationBuckets.get(key) ?? 0) + 1);
  }

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const key = metricKey(name, labels);
    this.setWithLimit(this.gauges, key, value);
  }

  snapshot(): Record<string, Record<string, number>> {
    return {
      counters: Object.fromEntries(this.counters),
      duration_buckets: Object.fromEntries(this.durationBuckets),
      gauges: Object.fromEntries(this.gauges),
      internal: { dropped_series_total: this.droppedSeries },
    };
  }

  reset(): void {
    this.counters.clear();
    this.durationBuckets.clear();
    this.gauges.clear();
    this.droppedSeries = 0;
  }

  private setWithLimit(map: Map<CounterKey, number>, key: CounterKey, value: number): void {
    if (!map.has(key) && map.size >= this.maxSeriesPerMetricType) {
      this.droppedSeries += 1;
      return;
    }
    map.set(key, value);
  }
}

export const metrics = new MetricsRegistry();

export function recordCacheStatus(status: string): void {
  metrics.increment('cache_requests_total', { status });
}

export function recordCrawlRun(source: string, status: string): void {
  metrics.increment('crawl_runs_total', { source, status });
}

export function recordSourceStaleness(source: string, level: string): void {
  metrics.setGauge('source_staleness_level', stalenessValue(level), { source, level });
}

export function recordPriceNoData(): void {
  metrics.increment('price_lookup_no_data_total');
}

function metricKey(name: string, labels: MetricLabels): string {
  const labelText = Object.entries(labels)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(',');
  return labelText ? `${name}{${labelText}}` : name;
}

function bucketDuration(durationMs: number): string {
  if (durationMs <= 10) return '10';
  if (durationMs <= 50) return '50';
  if (durationMs <= 100) return '100';
  if (durationMs <= 250) return '250';
  if (durationMs <= 500) return '500';
  if (durationMs <= 1000) return '1000';
  return '+Inf';
}

function stalenessValue(level: string): number {
  if (level === 'fresh') return 0;
  if (level === 'stale') return 1;
  return 2;
}
