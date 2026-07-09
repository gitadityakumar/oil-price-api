export interface FreshnessInput {
  sourceType: string | null | undefined;
  reliabilityTier: string | null | undefined;
  applicableDate: string;
  effectiveAt: string | null;
  observedAt: string;
  now?: Date;
}

const IST_FORMAT = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const IST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export class FreshnessService {
  buildBadge(input: FreshnessInput): string {
    const now = input.now ?? new Date();
    const observed = new Date(input.observedAt);
    const applicable = input.applicableDate.slice(0, 10);
    const todayIst = IST_DATE_FORMAT.format(now);
    const observedDateIst = IST_DATE_FORMAT.format(observed);
    const observedTimeIst = IST_FORMAT.format(observed);
    const ageHours = (now.getTime() - observed.getTime()) / 3_600_000;

    if (applicable !== todayIst) {
      return `Historical warehouse snapshot from ${applicable}`;
    }
    if (ageHours > 24) {
      return `Stale: last observed ${Math.floor(ageHours)} hours ago`;
    }
    if (input.sourceType === 'cgd') {
      return `Observed from CGD operator on ${observedDateIst} at ${observedTimeIst} IST`;
    }
    const official = input.reliabilityTier === 'highest' || input.sourceType === 'ppac' || input.sourceType === 'omc';
    if (official) return `Observed from official source today at ${observedTimeIst} IST`;
    return `Observed from source today at ${observedTimeIst} IST`;
  }
}
