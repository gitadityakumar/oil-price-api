import { logger } from '../logging/logger';
import { recordSourceStaleness } from './metrics';

const log = logger.child('staleness');

export type StalenessState = 'fresh' | 'stale' | 'expired';

export type StalenessInput = {
  source_key: string;
  last_successful_crawl_at: string | Date | null;
  expected_cadence_minutes: number;
  recent_failure_count?: number;
};

export function evaluateStaleness(input: StalenessInput, now = new Date()): StalenessState {
  if (!input.last_successful_crawl_at) return emit(input.source_key, 'expired');
  const last = input.last_successful_crawl_at instanceof Date
    ? input.last_successful_crawl_at
    : new Date(input.last_successful_crawl_at);
  const ageMs = now.getTime() - last.getTime();
  const ageMinutes = Math.max(0, ageMs / 60_000);
  const ageHours = ageMinutes / 60;

  if ((input.recent_failure_count ?? 0) >= 3 || ageHours >= 24) {
    return emit(input.source_key, 'expired');
  }
  if (ageMinutes > input.expected_cadence_minutes) {
    return emit(input.source_key, 'stale');
  }
  return emit(input.source_key, 'fresh');
}

function emit(sourceKey: string, state: StalenessState): StalenessState {
  recordSourceStaleness(sourceKey, state);
  if (state === 'expired') log.error('source expired', { source_key: sourceKey, staleness: state });
  else if (state === 'stale') log.warn('source stale', { source_key: sourceKey, staleness: state });
  return state;
}
