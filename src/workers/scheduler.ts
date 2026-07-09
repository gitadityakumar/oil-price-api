import { IngestionService } from '../modules/ingestion/ingestion.service';

export const schedulerConfig = {
  liquidFuelCrawls: ['06:05', '06:20', '07:00', '12:30'],
  gasFullCrawls: ['06:30', '14:00'],
  gasDiffWatcherEveryMinutes: 180,
  timezone: 'Asia/Kolkata',
} as const;

async function main(): Promise<void> {
  // Local-portable scheduler stub: run all implemented fixture adapters once.
  const svc = new IngestionService();
  await svc.runFixture('ppac_rsp');
  await svc.runFixture('igl_prices');
}

void main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.stack ?? error.message : String(error)) + '\n');
  process.exit(1);
});
