import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { closePool } from '../db/pool';
import { closeRedis } from '../core/redis/redis-client';
import { IngestionService } from '../modules/ingestion/ingestion.service';

let stopping = false;

async function main(): Promise<void> {
  const fixtureIndex = process.argv.indexOf('--fixture');
  const service = new IngestionService();
  if (fixtureIndex >= 0) {
    const sourceKey = process.argv[fixtureIndex + 1];
    if (!sourceKey) throw new Error('usage: ingestion-worker --fixture <source_key>');
    process.stdout.write(`${JSON.stringify(await service.runFixture(sourceKey))}\n`);
    return;
  }

  const workerId = `worker_${randomUUID()}`;
  while (!stopping) {
    const worked = await service.runNextQueuedJob(workerId);
    if (!worked) await delay(1_000);
  }
}

process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await closeRedis();
  await closePool();
});
