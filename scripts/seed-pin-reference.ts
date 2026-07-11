import { COVERAGE_CITIES, expandCityPins, totalPinCount } from './data/coverage-cities';
import { getPool, closePool } from '../src/db/pool';

const PLAN1_SOURCES = [
  'ppac_rsp',
  'igl_prices',
  'mgl_prices',
  'mngl_prices',
  'gujarat_gas_prices',
] as const;

async function upsertCityAnchor(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { geography_id: number }[] }> },
  city: (typeof COVERAGE_CITIES)[number],
): Promise<number> {
  const canonicalLabel = `${city.city}, ${city.stateCode} ${city.anchorPin}`;
  const result = await client.query(
    `insert into geography_dim (country_code, state_name, state_code, city_name, pincode, canonical_label)
     values ('IN', $1, $2, $3, $4, $5)
     on conflict (lower(canonical_label), (coalesce(pincode, ''))) do update set
       state_name = excluded.state_name,
       state_code = excluded.state_code,
       city_name = excluded.city_name,
       pincode = excluded.pincode,
       updated_at = now()
     returning geography_id`,
    [city.state, city.stateCode, city.city, city.anchorPin, canonicalLabel],
  );
  return Number(result.rows[0].geography_id);
}

async function main(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  let resolutionRows = 0;

  try {
    await client.query('begin');
    await client.query('delete from pincode_resolution where resolution_id >= 10000');

    for (const sourceKey of PLAN1_SOURCES) {
      await client.query(
        `update source_catalog
            set ingestion_enabled = true,
                public_display_enabled = true,
                rights_status = 'approved',
                commercial_use_allowed = true,
                updated_at = now()
          where source_key = $1`,
        [sourceKey],
      );
    }

    let resolutionId = 10_000;
    for (const city of COVERAGE_CITIES) {
      const geographyId = await upsertCityAnchor(client, city);
      for (const pin of expandCityPins(city)) {
        await client.query(
          `insert into pincode_resolution (
             resolution_id, pincode, geography_id, outlet_id,
             resolution_method, priority_rank, confidence_modifier, active
           ) values ($1, $2, $3, null, 'city_fallback', 4, 0.80, true)
           on conflict (resolution_id) do update set
             geography_id = excluded.geography_id,
             active = true,
             updated_at = now()`,
          [resolutionId, pin, geographyId],
        );
        resolutionId += 1;
        resolutionRows += 1;
      }
    }

    await client.query('commit');
    process.stdout.write(JSON.stringify({
      cities: COVERAGE_CITIES.length,
      pins: totalPinCount(),
      resolution_rows: resolutionRows,
      sources_enabled: PLAN1_SOURCES,
    }, null, 2));
    process.stdout.write('\n');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});