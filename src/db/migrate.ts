import { readdir, readFile } from 'node:fs/promises';
import { join, basename, extname, resolve } from 'node:path';
import { getPool, closePool } from './pool';
import { logger } from '../core/logging/logger';

const log = logger.child('migrate');

// Migrations live at <repo>/migrations. Resolve from cwd so this works under
// tsx (src/db/migrate.ts) and the compiled CJS (dist/db/migrate.js).
const MIGRATIONS_DIR = resolve(process.cwd(), 'migrations');

const MIGRATION_TABLE_SQL = `
create table if not exists schema_migration (
  version text primary key,
  applied_at timestamptz not null default now()
);
`;

type ExecClient = {
  query(text: string, params?: unknown[]): Promise<{ rows: { version?: string }[]; rowCount: number }>;
};

async function listMigrations(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((f) => extname(f) === '.sql')
    .sort();
}

async function isApplied(version: string, client: ExecClient): Promise<boolean> {
  const res = await client.query(
    'select version from schema_migration where version = $1',
    [version],
  );
  return res.rows.length > 0;
}

async function recordMigration(version: string, client: ExecClient): Promise<void> {
  await client.query(
    'insert into schema_migration (version) values ($1) on conflict do nothing',
    [version],
  );
}

async function applyMigrations(seedOnly: boolean): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_TABLE_SQL);
    log.info('schema_migration table ready');

    const files = await listMigrations();
    if (files.length === 0) {
      log.warn('no migration files found', { dir: MIGRATIONS_DIR });
      return;
    }

    for (const file of files) {
      const version = basename(file, '.sql');
      const isSeed = /seed/i.test(version);

      if (seedOnly) {
        // --seed: apply all schema migrations AND seed files
        // (seeds depend on schema being fully up to date).
      } else {
        // default: apply non-seed migrations only; skip seed files.
        if (isSeed) continue;
      }

      const applied = await isApplied(version, client);
      if (applied) {
        log.info('skip already applied', { version });
        continue;
      }

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      log.info('applying', { version, bytes: sql.length });

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await recordMigration(version, client);
        await client.query('COMMIT');
        log.info('applied', { version });
      } catch (err) {
        await client.query('ROLLBACK');
        const message = err instanceof Error ? err.message : String(err);
        log.error('migration failed', { version, err: message });
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const seedOnly = process.argv.includes('--seed');
  log.info('migrate starting', { seed_only: seedOnly, dir: MIGRATIONS_DIR });
  try {
    await applyMigrations(seedOnly);
    log.info('migrate complete');
  } catch (err) {
    log.error('migrate aborted', { err: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

void main();