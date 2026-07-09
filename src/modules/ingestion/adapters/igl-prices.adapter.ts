import type { CapturedArtifact, IngestionContext, ParsedPriceRecord, SourceAdapter, SourceArtifactInput, NormalizedPriceFact } from '../source-adapter';
import { StubAdapter } from './_stub-adapter';
import { fetchArtifact } from '../http-fetcher';
import { normalizeParsedRecord } from '../normalizer';

const LIVE_URL = 'https://www.iglonline.net/current-cng-png-prices';

export class IglPricesAdapter extends StubAdapter implements SourceAdapter {
  sourceKey = 'igl_prices' as const;
  sourceType = 'cgd' as const;
  mode = 'primary' as const;

  async fetchArtifacts(ctx: IngestionContext): Promise<SourceArtifactInput[]> {
    if (ctx.liveFetch) {
      const fetched = await fetchArtifact(LIVE_URL);
      return [{ artifactType: 'html', originalUrl: LIVE_URL, bytes: fetched.bytes, metadata: { http_status: fetched.status } }];
    }
    return [{ artifactType: 'html', originalUrl: 'fixture://igl_prices/current.html', bytes: await this.loadFixture('current.html') }];
  }

  async parseArtifact(artifact: CapturedArtifact, _ctx: IngestionContext): Promise<ParsedPriceRecord[]> {
    const html = artifact.bytes.toString('utf8');
    const rows = [...html.matchAll(/<tr[^>]*data-row="price"[^>]*>([\s\S]*?)<\/tr>/g)];
    return rows.map((match) => {
      const row = match[1];
      const fuel = cell(row, 'fuel') as ParsedPriceRecord['fuelCode'];
      const city = cell(row, 'city');
      const state = cell(row, 'state');
      const pin = cell(row, 'pin');
      return {
        fuelCode: fuel,
        applicableDate: cell(row, 'date'),
        effectiveAt: `${cell(row, 'date')}T08:35:00.000Z`,
        observedAt: `${cell(row, 'date')}T08:35:00.000Z`,
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
      };
    });
  }

  async normalize(record: ParsedPriceRecord, _ctx: IngestionContext): Promise<NormalizedPriceFact[]> {
    return [normalizeParsedRecord(this.sourceKey, record)];
  }
}

function cell(row: string, key: string): string {
  const match = row.match(new RegExp(`<td[^>]*data-col="${key}"[^>]*>(.*?)<\\/td>`));
  return match ? decode(match[1]) : '';
}

function decode(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
