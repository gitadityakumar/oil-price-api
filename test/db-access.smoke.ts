import { query } from '../src/db/query';
import { withTransaction } from '../src/db/transaction';
import { closePool } from '../src/db/pool';
import { AppError } from '../src/core/errors/app-error';

async function main(): Promise<void> {
  const { rows } = await query<{ fuel_code: string; display_name: string }>(
    'select fuel_code, display_name from fuel_dim order by fuel_code',
  );
  console.log('fuels:', rows.map((r) => `${r.fuel_code}=${r.display_name}`).join(', '));
  if (rows.length !== 6) throw new Error(`expected 6 fuels, got ${rows.length}`);

  let txCount = 0;
  await withTransaction(async ({ query: q }) => {
    const r = await q<{ c: string }>('select count(*)::text as c from source_catalog');
    txCount = Number(r.rows[0].c);
  });
  console.log('sources in tx:', txCount);
  if (txCount !== 10) throw new Error(`expected 10 sources, got ${txCount}`);

  // rollback path: throwing inside tx must abort and propagate
  let rolled = false;
  try {
    await withTransaction(async ({ query: q }) => {
      await q('insert into fuel_dim (fuel_code, display_name, retail_unit) values ($1,$2,$3) on conflict do nothing', ['PETROL', 'dup', 'LTR']);
      throw new AppError('CONFLICT', 'force rollback');
    });
  } catch (e) {
    rolled = e instanceof AppError && e.code === 'CONFLICT';
  }
  if (!rolled) throw new Error('tx rollback did not propagate AppError');
  console.log('rollback ok');
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAIL', err);
    closePool().finally(() => process.exit(1));
  });