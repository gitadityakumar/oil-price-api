import { IngestionService } from '../modules/ingestion/ingestion.service';

async function main(): Promise<void> {
  const sourceKey = process.argv[2];
  if (!sourceKey) {
    throw new Error('usage: node dist/workers/ingestion-worker.js <source_key>');
  }
  const result = await new IngestionService().runFixture(sourceKey);
  process.stdout.write(JSON.stringify(result) + '\n');
}

void main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.stack ?? error.message : String(error)) + '\n');
  process.exit(1);
});
