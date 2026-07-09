import { createHash } from 'node:crypto';
import { createArtifactStore } from './artifact-store';
import { getSourceAdapter } from './source-registry';
import { createCrawlRun, findSourceByKey, finishCrawlRun, recordSourceArtifact } from './ingestion.repository';
import { upsertPriceFacts } from './upsert-price-facts';
import type { IngestionRunRequest, IngestionRunResponse } from './ingestion.model';
import type { CapturedArtifact, IngestionContext } from './source-adapter';
import { config } from '../../config/env';
import { AppError } from '../../core/errors/app-error';

export class IngestionService {
  private readonly artifactStore = createArtifactStore();

  async startManualRun(input: IngestionRunRequest): Promise<IngestionRunResponse> {
    const source = await findSourceByKey(input.source_key);
    if (!source) throw new AppError('NOT_FOUND', `Unknown source_key: ${input.source_key}`, 404);
    const adapter = getSourceAdapter(input.source_key);
    if (!adapter) throw new AppError('NOT_IMPLEMENTED', `No adapter registered for source_key: ${input.source_key}`, 501);

    const crawlRunId = await createCrawlRun({ source_id: source.source_id });
    const ctx: IngestionContext = {
      sourceKey: input.source_key,
      mode: 'manual',
      reason: input.reason,
      liveFetch: config.ingestionLiveFetch,
      now: new Date(),
      crawlRunId,
    };

    setImmediate(() => {
      void this.runAdapter(adapter, source.source_id, crawlRunId, ctx);
    });

    return { crawl_run_id: crawlRunId, source_key: input.source_key, status: 'started' };
  }

  async runFixture(sourceKey: string): Promise<{ crawl_run_id: number; records_seen: number; records_written: number }> {
    const source = await findSourceByKey(sourceKey);
    if (!source) throw new AppError('NOT_FOUND', `Unknown source_key: ${sourceKey}`, 404);
    const adapter = getSourceAdapter(sourceKey);
    if (!adapter) throw new AppError('NOT_IMPLEMENTED', `No adapter registered for source_key: ${sourceKey}`, 501);
    const crawlRunId = await createCrawlRun({ source_id: source.source_id });
    const ctx: IngestionContext = { sourceKey, mode: 'fixture', liveFetch: false, now: new Date(), crawlRunId };
    return this.runAdapter(adapter, source.source_id, crawlRunId, ctx);
  }

  private async runAdapter(adapter: NonNullable<ReturnType<typeof getSourceAdapter>>, sourceId: number, crawlRunId: number, ctx: IngestionContext): Promise<{ crawl_run_id: number; records_seen: number; records_written: number }> {
    try {
      const artifacts = await adapter.fetchArtifacts(ctx);
      const captured: CapturedArtifact[] = [];
      for (const artifact of artifacts) {
        const contentHash = createHash('sha256').update(artifact.bytes).digest('hex');
        const storageUri = await this.artifactStore.put({
          sourceKey: adapter.sourceKey,
          contentHash,
          artifactType: artifact.artifactType,
          bytes: artifact.bytes,
          date: ctx.now.toISOString().slice(0, 10),
        });
        const cap: CapturedArtifact = {
          sourceKey: adapter.sourceKey,
          artifactType: artifact.artifactType,
          originalUrl: artifact.originalUrl,
          bytes: artifact.bytes,
          contentHash,
          storageUri,
          metadata: artifact.metadata ?? {},
        };
        captured.push(cap);
        await recordSourceArtifact({ sourceId, crawlRunId, artifact: cap });
      }

      const parsed = [];
      for (const artifact of captured) {
        parsed.push(...await adapter.parseArtifact(artifact, ctx));
      }

      const normalized = [];
      for (const record of parsed) {
        normalized.push(...await adapter.normalize(record, ctx));
      }

      const recordsWritten = await upsertPriceFacts(sourceId, normalized);
      await finishCrawlRun({
        crawl_run_id: crawlRunId,
        status: normalized.length > 0 ? 'success' : 'skipped',
        records_seen: parsed.length,
        records_written: recordsWritten,
        notes: normalized.length > 0 ? 'fixture/live ingestion completed' : 'no normalized records produced',
      });
      return { crawl_run_id: crawlRunId, records_seen: parsed.length, records_written: recordsWritten };
    } catch (error) {
      await finishCrawlRun({
        crawl_run_id: crawlRunId,
        status: 'failed',
        records_seen: 0,
        records_written: 0,
        error_code: error instanceof AppError ? error.code : 'INGESTION_FAILED',
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
