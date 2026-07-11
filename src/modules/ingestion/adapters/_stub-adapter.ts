import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IngestionContext, ParsedPriceRecord, SourceAdapter, SourceArtifactInput, CapturedArtifact, NormalizedPriceFact } from '../source-adapter';
import { AppError } from '../../../core/errors/app-error';

export abstract class StubAdapter implements SourceAdapter {
  abstract sourceKey: string;
  abstract sourceType: SourceAdapter['sourceType'];
  abstract mode: SourceAdapter['mode'];
  version = 'fixture-v1';
  capabilities: SourceAdapter['capabilities'] = { fixture: false, live: false, allowedHosts: [] };

  async fetchArtifacts(_ctx: IngestionContext): Promise<SourceArtifactInput[]> {
    throw new AppError('NOT_IMPLEMENTED', `Adapter not implemented yet: ${this.sourceKey}`, 501);
  }

  async parseArtifact(_artifact: CapturedArtifact, _ctx: IngestionContext): Promise<ParsedPriceRecord[]> {
    return [];
  }

  async normalize(_record: ParsedPriceRecord, _ctx: IngestionContext): Promise<NormalizedPriceFact[]> {
    return [];
  }

  protected async loadFixture(fileName: string): Promise<Buffer> {
    return readFile(join(process.cwd(), 'fixtures', 'ingestion', this.sourceKey, fileName));
  }

  protected async loadCoverageFixture(): Promise<Buffer> {
    try {
      return await this.loadFixture('metros.html');
    } catch {
      return await this.loadFixture('current.html');
    }
  }
}
