import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COVERAGE_CITIES, type CgdSource } from './data/coverage-cities';
import { cgdPriceRow, derivePpacComponents, ppacPriceRow, wrapFixtureTable } from './lib/fixture-html';

function todayInKolkata(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

async function writeFixture(sourceKey: string, fileName: string, html: string): Promise<void> {
  const dir = join(process.cwd(), 'fixtures', 'ingestion', sourceKey);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName), html, 'utf8');
}

function buildPpacFixture(date: string): string {
  const rows: string[] = [];
  for (const city of COVERAGE_CITIES) {
    const petrolParts = derivePpacComponents(city.petrol);
    const dieselParts = derivePpacComponents(city.diesel);
    rows.push(ppacPriceRow({
      fuel: 'PETROL',
      price: city.petrol,
      date,
      state: city.state,
      stateCode: city.stateCode,
      city: city.city,
      pin: city.anchorPin,
      ...petrolParts,
    }));
    rows.push(ppacPriceRow({
      fuel: 'DIESEL',
      price: city.diesel,
      date,
      state: city.state,
      stateCode: city.stateCode,
      city: city.city,
      pin: city.anchorPin,
      ...dieselParts,
    }));
  }
  return wrapFixtureTable(rows);
}

function buildCgdFixture(source: CgdSource, date: string): string {
  const rows: string[] = [];
  for (const city of COVERAGE_CITIES.filter((c) => c.cgdSource === source && c.cng && c.png)) {
    rows.push(cgdPriceRow({
      fuel: 'CNG',
      price: city.cng!,
      date,
      state: city.state,
      city: city.city,
      pin: city.anchorPin,
    }));
    rows.push(cgdPriceRow({
      fuel: 'PNG',
      price: city.png!,
      date,
      state: city.state,
      city: city.city,
      pin: city.anchorPin,
    }));
  }
  return wrapFixtureTable(rows);
}

async function main(): Promise<void> {
  const date = todayInKolkata();
  await writeFixture('ppac_rsp', 'metros.html', buildPpacFixture(date));
  await writeFixture('igl_prices', 'metros.html', buildCgdFixture('igl_prices', date));
  await writeFixture('mgl_prices', 'metros.html', buildCgdFixture('mgl_prices', date));
  await writeFixture('mngl_prices', 'metros.html', buildCgdFixture('mngl_prices', date));
  await writeFixture('gujarat_gas_prices', 'metros.html', buildCgdFixture('gujarat_gas_prices', date));
  process.stdout.write(`generated coverage fixtures for ${date}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});