import { upsertNormalizedFacts } from './ingestion.repository';
import type { NormalizedPriceFact } from './source-adapter';
import type { IngestionWriteSummary } from './ingestion.model';

export async function upsertPriceFacts(sourceId: number, facts: NormalizedPriceFact[]): Promise<IngestionWriteSummary> {
  return upsertNormalizedFacts(sourceId, facts);
}
