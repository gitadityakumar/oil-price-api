import { createHash } from 'node:crypto';
import { createArtifactStore } from './artifact-store';
import { requireRunnableAdapter } from './source-registry';
import { claimNextIngestionJob, createCrawlRun, enqueueIngestionJob, findSourceByKey, finishCrawlRun, finishIngestionJob, recordSourceArtifact } from './ingestion.repository';
import { upsertPriceFacts } from './upsert-price-facts';
import type { IngestionRunRequest, IngestionRunResponse } from './ingestion.model';
import type { CapturedArtifact, IngestionContext, NormalizedPriceFact, ParsedPriceRecord, SourceAdapter } from './source-adapter';
import { AppError } from '../../core/errors/app-error';
import { getCache } from '../../core/cache/cache';
import { sourceHealthCacheKey } from '../../core/cache/cache-key';
import { recordCrawlRun } from '../../core/observability/metrics';

export class IngestionService {
  private readonly artifactStore = createArtifactStore();

  async startManualRun(input: IngestionRunRequest): Promise<IngestionRunResponse> {
    const source = await findSourceByKey(input.source_key);
    if (!source) throw new AppError('NOT_FOUND', `Unknown source_key: ${input.source_key}`, 404);
    if (!source.active || !source.ingestion_enabled) {
      throw new AppError('FORBIDDEN', 'Source ingestion is disabled', 403);
    }
    const adapter = requireRunnableAdapter(input.source_key, 'live');
    if (!adapter) throw new AppError('NOT_IMPLEMENTED', 'No production-validated live adapter is available for this source', 501);

    const crawlRunId = await createCrawlRun({ source_id: source.source_id });
    await enqueueIngestionJob({ sourceId: source.source_id, crawlRunId, reason: input.reason });
    return { crawl_run_id: crawlRunId, source_key: input.source_key, status: 'queued' };
  }

  async runFixture(sourceKey: string): Promise<{ crawl_run_id: number; records_seen: number; records_written: number }> {
    const source = await findSourceByKey(sourceKey);
    if (!source) throw new AppError('NOT_FOUND', `Unknown source_key: ${sourceKey}`, 404);
    const adapter = requireRunnableAdapter(sourceKey, 'fixture');
    if (!adapter) throw new AppError('NOT_IMPLEMENTED', `No fixture adapter registered for source_key: ${sourceKey}`, 501);
    const crawlRunId = await createCrawlRun({ source_id: source.source_id });
    const ctx: IngestionContext = { sourceKey, mode: 'fixture', liveFetch: false, now: new Date(), crawlRunId };
    return this.runAdapter(adapter, source.source_id, crawlRunId, ctx);
  }

  async runNextQueuedJob(workerId: string): Promise<boolean> {
    const job = await claimNextIngestionJob(workerId);
    if (!job) return false;
    const adapter = requireRunnableAdapter(job.source_key, 'live');
    if (!adapter) {
      await finishCrawlRun({
        crawl_run_id: job.crawl_run_id,
        status: 'failed',
        error_code: 'NOT_IMPLEMENTED',
        error_message: 'No production-validated live adapter is available',
      });
      await finishIngestionJob(job.ingestion_job_id, 'failed', 'NOT_IMPLEMENTED');
      return true;
    }
    const ctx: IngestionContext = {
      sourceKey: job.source_key,
      mode: job.run_mode,
      reason: job.reason ?? undefined,
      liveFetch: true,
      now: new Date(),
      crawlRunId: job.crawl_run_id,
    };
    try {
      await this.runAdapter(adapter, job.source_id, job.crawl_run_id, ctx);
      await finishIngestionJob(job.ingestion_job_id, 'succeeded');
    } catch (error) {
      await finishIngestionJob(job.ingestion_job_id, 'failed', error instanceof AppError ? error.code : 'INGESTION_FAILED');
    }
    return true;
  }

  private async runAdapter(adapter: SourceAdapter, sourceId: number, crawlRunId: number, ctx: IngestionContext): Promise<{ crawl_run_id: number; records_seen: number; records_written: number }> {
    try {
      const artifacts = await adapter.fetchArtifacts(ctx);
      const captured: CapturedArtifact[] = [];
      for (const artifact of artifacts) {
        const contentHash = `sha256:${createHash('sha256').update(artifact.bytes).digest('hex')}`;
        const capturedAt = new Date().toISOString();
        const storageUri = await this.artifactStore.put({
          sourceKey: adapter.sourceKey,
          contentHash,
          artifactType: artifact.artifactType,
          bytes: artifact.bytes,
          date: ctx.now.toISOString().slice(0, 10),
        });
        const cap: CapturedArtifact = {
          artifactId: 0,
          sourceKey: adapter.sourceKey,
          artifactType: artifact.artifactType,
          originalUrl: artifact.originalUrl,
          bytes: artifact.bytes,
          contentHash,
          capturedAt,
          storageUri,
          metadata: artifact.metadata ?? {},
        };
        const artifactId = await recordSourceArtifact({ sourceId, crawlRunId, artifact: cap });
        captured.push({ ...cap, artifactId });
      }

      const parsed: ParsedPriceRecord[] = [];
      for (const artifact of captured) {
        const records = await adapter.parseArtifact(artifact, ctx);
        parsed.push(...records.map((record) => ({
          ...record,
          observedAt: artifact.capturedAt,
          evidence: {
            artifactId: artifact.artifactId,
            contentHash: artifact.contentHash,
            capturedAt: artifact.capturedAt,
            originalUrl: artifact.originalUrl,
            parserVersion: adapter.version,
          },
        })));
      }

      const normalized: NormalizedPriceFact[] = [];
      for (const record of parsed) {
        normalized.push(...await adapter.normalize(record, ctx));
      }

      const writeSummary = await upsertPriceFacts(sourceId, normalized);
      const recordsWritten = writeSummary.inserted_or_updated;
      const status = normalized.length === 0
        ? 'skipped'
        : recordsWritten === 0
          ? 'failed'
          : writeSummary.rejected > 0
            ? 'partial'
            : 'success';
      await finishCrawlRun({
        crawl_run_id: crawlRunId,
        status,
        records_seen: parsed.length,
        records_written: recordsWritten,
        records_rejected: writeSummary.rejected,
        notes: status === 'skipped' ? 'no normalized records produced' : 'ingestion completed',
      });
      await afterCrawlTerminal(adapter.sourceKey, status);
      return { crawl_run_id: crawlRunId, records_seen: parsed.length, records_written: recordsWritten };
    } catch (error) {
      await finishCrawlRun({
        crawl_run_id: crawlRunId,
        status: 'failed',
        records_seen: 0,
        records_written: 0,
        error_code: error instanceof AppError ? error.code : 'INGESTION_FAILED',
        error_message: 'Ingestion run failed',
      });
      await afterCrawlTerminal(adapter.sourceKey, 'failed');
      throw error;
    }
  }
}

async function afterCrawlTerminal(sourceKey: string, status: string): Promise<void> {
  recordCrawlRun(sourceKey, status);
  try {
    await getCache().delete(sourceHealthCacheKey('all'));
  } catch { /* cache invalidation is best effort */ }
}
