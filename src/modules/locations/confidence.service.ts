export interface ConfidenceInput {
  reliabilityTier: string | null | undefined;
  method: 'direct_station_pin' | 'nearest_station_geo' | 'tariff_area_mapping' | 'city_fallback';
  applicableDate: string;
  observedAt: string;
  effectiveAt?: string | null;
  resolutionModifier?: number;
  hasComponents: boolean;
  now?: Date;
}

const SOURCE_SCORE: Record<string, number> = {
  highest: 0.98,
  high: 0.92,
  medium: 0.78,
  low: 0.60,
};

const RESOLUTION_MODIFIER: Record<ConfidenceInput['method'], number> = {
  direct_station_pin: 1.00,
  nearest_station_geo: 0.92,
  tariff_area_mapping: 0.88,
  city_fallback: 0.78,
};

export class ConfidenceService {
  score(input: ConfidenceInput): number {
    const base = SOURCE_SCORE[input.reliabilityTier ?? ''] ?? SOURCE_SCORE.low;
    const resolution = input.resolutionModifier ?? RESOLUTION_MODIFIER[input.method];
    const freshness = freshnessModifier(input.applicableDate, input.observedAt, input.now ?? new Date());
    const component = input.hasComponents ? 1.00 : 0.97;
    return roundClamp(base * resolution * freshness * component);
  }
}

function freshnessModifier(applicableDate: string, observedAt: string, now: Date): number {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  if (applicableDate.slice(0, 10) !== today) return 0.95;
  const hours = (now.getTime() - new Date(observedAt).getTime()) / 3_600_000;
  if (hours <= 2) return 1.00;
  if (hours <= 24) return 0.90;
  return 0.65;
}

function roundClamp(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}
