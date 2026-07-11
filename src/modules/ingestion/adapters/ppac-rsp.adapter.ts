import type { CapturedArtifact, IngestionContext, ParsedPriceRecord, SourceAdapter, SourceArtifactInput, NormalizedPriceFact } from '../source-adapter';
import { StubAdapter } from './_stub-adapter';
import { fetchArtifact } from '../http-fetcher';
import { normalizeParsedRecord } from '../normalizer';
import { buildPpacRecords, parseFixturePriceRows } from './fixture-html';

const LIVE_URL = 'https://ppac.gov.in/retail-selling-price-rsp-of-petrol-diesel-and-domestic-lpg/price-build-up-of-petrol-and-diesel';

export class PpacRspAdapter extends StubAdapter implements SourceAdapter {
  sourceKey = 'ppac_rsp' as const;
  sourceType = 'ppac' as const;
  mode = 'primary' as const;
  override capabilities = { fixture: true, live: false, allowedHosts: ['ppac.gov.in'] } as const;

  async fetchArtifacts(ctx: IngestionContext): Promise<SourceArtifactInput[]> {
    if (ctx.liveFetch) {
      const fetched = await fetchArtifact(LIVE_URL, { allowedHosts: this.capabilities.allowedHosts, allowedContentTypes: ['text/html'] });
      return [{ artifactType: 'html', originalUrl: LIVE_URL, bytes: fetched.bytes, metadata: { http_status: fetched.status } }];
    }
    let bytes: Buffer;
    let file = 'metros.html';
    try {
      bytes = await this.loadFixture('metros.html');
    } catch {
      bytes = await this.loadFixture('current.html');
      file = 'current.html';
    }
    return [{ artifactType: 'html', originalUrl: `fixture://ppac_rsp/${file}`, bytes }];
  }

  async parseArtifact(artifact: CapturedArtifact, ctx: IngestionContext): Promise<ParsedPriceRecord[]> {
    const rows = parseFixturePriceRows(artifact.bytes.toString('utf8'));
    return buildPpacRecords(rows, artifact, ctx, this.version);
  }

  async normalize(record: ParsedPriceRecord, _ctx: IngestionContext): Promise<NormalizedPriceFact[]> {
    return [normalizeParsedRecord(this.sourceKey, record)];
  }
}