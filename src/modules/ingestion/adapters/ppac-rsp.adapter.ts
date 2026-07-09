import type { CapturedArtifact, IngestionContext, ParsedPriceRecord, SourceAdapter, SourceArtifactInput, NormalizedPriceFact } from '../source-adapter';
import { StubAdapter } from './_stub-adapter';
import { fetchArtifact } from '../http-fetcher';
import { normalizeParsedRecord } from '../normalizer';

const LIVE_URL = 'https://ppac.gov.in/retail-selling-price';

export class PpacRspAdapter extends StubAdapter implements SourceAdapter {
  sourceKey = 'ppac_rsp' as const;
  sourceType = 'ppac' as const;
  mode = 'primary' as const;

  async fetchArtifacts(ctx: IngestionContext): Promise<SourceArtifactInput[]> {
    if (ctx.liveFetch) {
      const fetched = await fetchArtifact(LIVE_URL);
      return [{ artifactType: 'html', originalUrl: LIVE_URL, bytes: fetched.bytes, metadata: { http_status: fetched.status } }];
    }
    return [{ artifactType: 'html', originalUrl: 'fixture://ppac_rsp/current.html', bytes: await this.loadFixture('current.html') }];
  }

  async parseArtifact(artifact: CapturedArtifact, _ctx: IngestionContext): Promise<ParsedPriceRecord[]> {
    const html = artifact.bytes.toString('utf8');
    const rows = [...html.matchAll(/<tr[^>]*data-row="price"[^>]*>([\s\S]*?)<\/tr>/g)];
    return rows.map((match) => {
      const row = match[1];
      return {
        fuelCode: cell(row, 'fuel') as ParsedPriceRecord['fuelCode'],
        applicableDate: cell(row, 'date'),
        effectiveAt: `${cell(row, 'date')}T00:30:00.000Z`,
        observedAt: `${cell(row, 'date')}T00:47:00.000Z`,
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
