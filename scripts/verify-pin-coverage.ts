import { COVERAGE_CITIES, expandCityPins, totalPinCount } from './data/coverage-cities';
import { getPool, closePool } from '../src/db/pool';
import { todayInKolkata } from '../src/modules/prices/price.validation';

const MIN_PINS = 1000;
const SAMPLE_SIZE = 20;

async function main(): Promise<void> {
  const pool = getPool();
  const date = todayInKolkata();

  const pinCount = await pool.query<{ count: string }>(
    `select count(distinct pincode)::text as count from pincode_resolution where active = true`,
  );
  const resolvedPins = Number(pinCount.rows[0]?.count ?? 0);

  const liquidPins = await pool.query<{ count: string }>(
    `select count(distinct pr.pincode)::text as count
       from pincode_resolution pr
       join geography_dim g on g.geography_id = pr.geography_id
       join price_fact_daily p on p.geography_id = g.geography_id
       join fuel_dim f on f.fuel_id = p.fuel_id
       join source_catalog s on s.source_id = p.source_id
      where pr.active = true
        and f.fuel_code in ('PETROL', 'DIESEL')
        and p.applicable_date = $1::date
        and s.public_display_enabled = true
        and s.rights_status = 'approved'`,
    [date],
  );
  const liquidCoverage = Number(liquidPins.rows[0]?.count ?? 0);

  const samplePins = COVERAGE_CITIES
    .flatMap((city) => expandCityPins(city).slice(0, 1))
    .slice(0, SAMPLE_SIZE);

  const failures: string[] = [];
  for (const pin of samplePins) {
    const row = await pool.query<{ petrol: string | null }>(
      `select count(*)::text as petrol
         from pincode_resolution pr
         join geography_dim g on g.geography_id = pr.geography_id
         join price_fact_daily p on p.geography_id = g.geography_id
         join fuel_dim f on f.fuel_id = p.fuel_id
        where pr.pincode = $1
          and pr.active = true
          and f.fuel_code = 'PETROL'
          and p.applicable_date = $2::date`,
      [pin, date],
    );
    if (Number(row.rows[0]?.petrol ?? 0) === 0) failures.push(pin);
  }

  const report = {
    expected_pins: totalPinCount(),
    resolved_pins: resolvedPins,
    liquid_pin_coverage: liquidCoverage,
    sample_checked: samplePins.length,
    sample_failures: failures,
    date,
    pass: resolvedPins >= MIN_PINS && liquidCoverage >= MIN_PINS && failures.length === 0,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  await closePool();

  if (!report.pass) process.exitCode = 1;
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});