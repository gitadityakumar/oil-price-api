import { upsertNormalizedFacts } from './ingestion.repository';
import type { NormalizedPriceFact } from './source-adapter';

export async function upsertPriceFacts(sourceId: number, facts: NormalizedPriceFact[]): Promise<number> {
  return upsertNormalizedFacts(sourceId, facts);
}
