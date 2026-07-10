import { createHash } from 'node:crypto';
import type { NormalizedPriceFact, ParsedPriceRecord } from './source-adapter';

export function normalizeParsedRecord(sourceKey: string, record: ParsedPriceRecord): NormalizedPriceFact {
  if (!record.evidence) {
    throw new TypeError(`Parsed record from ${sourceKey} is missing artifact evidence`);
  }
  return {
    sourceKey,
    fuelCode: record.fuelCode,
    geography: record.geography,
    outlet: record.outlet,
    applicableDate: record.applicableDate,
    effectiveAt: record.effectiveAt,
    observedAt: record.observedAt,
    priceValue: record.priceValue,
    currencyCode: 'INR',
    priceKind: record.priceKind ?? 'retail',
    components: record.components,
    rawDocumentUrl: record.rawDocumentUrl,
    rawHash: record.evidence.contentHash,
    attributionText: record.attributionText ?? `Price normalized from ${sourceKey}.`,
    evidence: record.evidence,
  };
}

export function hashNormalizedRecord(sourceKey: string, record: ParsedPriceRecord): string {
  const stable = JSON.stringify({
    sourceKey,
    fuelCode: record.fuelCode,
    applicableDate: record.applicableDate,
    effectiveAt: record.effectiveAt ?? null,
    observedAt: record.observedAt,
    priceValue: record.priceValue,
    geography: record.geography ?? null,
    outlet: record.outlet ?? null,
    priceKind: record.priceKind ?? 'retail',
    components: record.components ?? [],
    rawDocumentUrl: record.rawDocumentUrl ?? null,
  });
  return `sha256:${createHash('sha256').update(stable).digest('hex')}`;
}

export function buildPublicPriceId(input: {
  sourceKey: string;
  fuelCode: string;
  applicableDate: string;
  priceKind: string;
  geographyKey?: string;
  outletKey?: string;
}): string {
  const raw = `${input.sourceKey}|${input.fuelCode}|${input.applicableDate}|${input.priceKind}|${input.geographyKey ?? ''}|${input.outletKey ?? ''}`;
  const suffix = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return `price_${suffix}`;
}
