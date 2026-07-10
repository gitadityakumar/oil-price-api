import { setTimeout as delay } from 'node:timers/promises';
import { closePool } from '../db/pool';
import { enqueueScheduledIngestion, listIngestionEnabledSources } from '../modules/ingestion/ingestion.repository';
import { requireRunnableAdapter } from '../modules/ingestion/source-registry';

export const schedulerConfig = {
  liquidFuelCrawls: ['06:05', '06:20', '07:00', '12:30'],
  gasFullCrawls: ['06:30', '14:00'],
  gasDiffWatcherEveryMinutes: 180,
  timezone: 'Asia/Kolkata',
} as const;

let stopping = false;

export async function scheduleDueRuns(now = new Date()): Promise<number> {
  const sources = await listIngestionEnabledSources();
  const slots = dueSlots(now);
  let queued = 0;
  for (const source of sources) {
    if (!requireRunnableAdapter(source.source_key, 'live')) continue;
    const sourceSlots = source.source_type === 'cgd' ? slots.gas : slots.liquid;
    for (const slot of sourceSlots) {
      if (await enqueueScheduledIngestion({ sourceId: source.source_id, runKind: slot.kind, scheduledFor: slot.at.toISOString() })) queued += 1;
    }
  }
  return queued;
}

async function main(): Promise<void> {
  while (!stopping) {
    await scheduleDueRuns();
    await delay(60_000);
  }
}

function dueSlots(now: Date): { liquid: Slot[]; gas: Slot[] } {
  const istDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: schedulerConfig.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const liquid = schedulerConfig.liquidFuelCrawls.map((time) => slot(istDate, time, 'full')).filter((item) => item.at <= now);
  const gas = schedulerConfig.gasFullCrawls.map((time) => slot(istDate, time, 'full')).filter((item) => item.at <= now);
  for (let minute = 0; minute < 24 * 60; minute += schedulerConfig.gasDiffWatcherEveryMinutes) {
    const hh = String(Math.floor(minute / 60)).padStart(2, '0');
    const mm = String(minute % 60).padStart(2, '0');
    const item = slot(istDate, `${hh}:${mm}`, 'diff');
    if (item.at <= now) gas.push(item);
  }
  return { liquid, gas };
}

function slot(date: string, time: string, kind: 'full' | 'diff'): Slot {
  return { kind, at: new Date(`${date}T${time}:00+05:30`) };
}

type Slot = { kind: 'full' | 'diff'; at: Date };

process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

if (require.main === module) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }).finally(() => closePool());
}
