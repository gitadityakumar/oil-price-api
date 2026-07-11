import type { CapturedArtifact, IngestionContext, ParsedPriceRecord, SourceArtifactInput, NormalizedPriceFact } from '../source-adapter';
import { StubAdapter } from './_stub-adapter';
import { fetchArtifact } from '../http-fetcher';
import { normalizeParsedRecord } from '../normalizer';
import { buildCgdRecords, parseFixturePriceRows } from './fixture-html';

export abstract class CgdFixtureAdapter extends StubAdapter {
  abstract liveUrl: string;

  override capabilities = { fixture: true, live: false, allowedHosts: [] as readonly string[] };

  async fetchArtifacts(ctx: IngestionContext): Promise<SourceArtifactInput[]> {
    if (ctx.liveFetch) {
      const fetched = await fetchArtifact(this.liveUrl, {
        allowedHosts: this.capabilities.allowedHosts,
        allowedContentTypes: ['text/html'],
      });
      return [{ artifactType: 'html', originalUrl: this.liveUrl, bytes: fetched.bytes, metadata: { http_status: fetched.status } }];
    }
    let bytes: Buffer;
    let file = 'metros.html';
    try {
      bytes = await this.loadFixture('metros.html');
    } catch {
      bytes = await this.loadFixture('current.html');
      file = 'current.html';
    }
    return [{ artifactType: 'html', originalUrl: `fixture://${this.sourceKey}/${file}`, bytes }];
  }

  async parseArtifact(artifact: CapturedArtifact, ctx: IngestionContext): Promise<ParsedPriceRecord[]> {
    const rows = parseFixturePriceRows(artifact.bytes.toString('utf8'));
    return buildCgdRecords(rows, artifact, ctx, this.version);
  }

  async normalize(record: ParsedPriceRecord, _ctx: IngestionContext): Promise<NormalizedPriceFact[]> {
    return [normalizeParsedRecord(this.sourceKey, record)];
  }
}