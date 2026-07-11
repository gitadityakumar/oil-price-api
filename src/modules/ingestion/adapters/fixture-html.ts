import type { CapturedArtifact, IngestionContext, ParsedPriceRecord } from '../source-adapter';

export function cell(row: string, key: string): string {
  const match = row.match(new RegExp(`<td[^>]*data-col="${key}"[^>]*>(.*?)<\\/td>`));
  return match ? decode(match[1]) : '';
}

function decode(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

export function parseFixturePriceRows(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*data-row="price"[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
}

export function buildPpacRecords(
  rows: string[],
  artifact: CapturedArtifact,
  ctx: IngestionContext,
  parserVersion: string,
): ParsedPriceRecord[] {
  return rows.map((row) => ({
    fuelCode: cell(row, 'fuel') as ParsedPriceRecord['fuelCode'],
    applicableDate: cell(row, 'date'),
    effectiveAt: `${cell(row, 'date')}T00:30:00.000Z`,
    observedAt: ctx.now.toISOString(),
    priceValue: cell(row, 'price'),
    unit: 'LTR',
    geography: {
      countryCode: 'IN',
      stateName: cell(row, 'state'),
      stateCode: cell(row, 'state_code'),
      cityName: cell(row, 'city'),
      pincode: cell(row, 'pin'),
      canonicalLabel: `${cell(row, 'city')}, ${cell(row, 'state_code')} ${cell(row, 'pin')}`,
    },
    priceKind: 'retail',
    components: [
      { name: 'base_price', value: cell(row, 'base_price'), unit: 'INR/LTR' },
      { name: 'excise', value: cell(row, 'excise'), unit: 'INR/LTR' },
      { name: 'vat', value: cell(row, 'vat'), unit: 'INR/LTR' },
      { name: 'dealer_commission', value: cell(row, 'dealer_commission'), unit: 'INR/LTR' },
    ],
    rawDocumentUrl: artifact.originalUrl,
    attributionText: 'Price normalized from official publication.',
    evidence: {
      artifactId: artifact.artifactId,
      contentHash: artifact.contentHash,
      capturedAt: artifact.capturedAt,
      originalUrl: artifact.originalUrl,
      parserVersion,
    },
  }));
}

export function buildCgdRecords(
  rows: string[],
  artifact: CapturedArtifact,
  ctx: IngestionContext,
  parserVersion: string,
): ParsedPriceRecord[] {
  return rows.map((row) => {
    const fuel = cell(row, 'fuel') as ParsedPriceRecord['fuelCode'];
    const city = cell(row, 'city');
    const state = cell(row, 'state');
    const pin = cell(row, 'pin');
    return {
      fuelCode: fuel,
      applicableDate: cell(row, 'date'),
      effectiveAt: `${cell(row, 'date')}T08:35:00.000Z`,
      observedAt: ctx.now.toISOString(),
      priceValue: cell(row, 'price'),
      unit: fuel === 'PNG' ? 'SCM' : 'KG',
      geography: {
        countryCode: 'IN',
        stateName: state,
        cityName: city,
        pincode: pin,
        canonicalLabel: `${city}, ${state} ${pin}`,
      },
      priceKind: 'retail',
      rawDocumentUrl: artifact.originalUrl,
      attributionText: 'Price normalized from CGD operator publication.',
      evidence: {
        artifactId: artifact.artifactId,
        contentHash: artifact.contentHash,
        capturedAt: artifact.capturedAt,
        originalUrl: artifact.originalUrl,
        parserVersion,
      },
    };
  });
}