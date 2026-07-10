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

type MigrationMode = 'schema' | 'seed' | 'fixtures';

async function applyMigrations(mode: MigrationMode): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(hashtext('oil-api-migrations'))");
    await client.query(MIGRATION_TABLE_SQL);
    log.info('schema_migration table ready');

    const files = await listMigrations();
    if (files.length === 0) {
      log.warn('no migration files found', { dir: MIGRATIONS_DIR });
      return;
    }

    for (const file of files) {
      const version = basename(file, '.sql');
      const isFixture = /fixture/i.test(version);
      const isSeed = /seed/i.test(version) && !isFixture;

      if (mode === 'schema' && (isSeed || isFixture)) continue;
      if (mode === 'seed' && isFixture) continue;

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
    await client.query("select pg_advisory_unlock(hashtext('oil-api-migrations'))").catch(() => undefined);
    client.release();
  }
}

async function main(): Promise<void> {
  const mode: MigrationMode = process.argv.includes('--fixtures')
    ? 'fixtures'
    : process.argv.includes('--seed')
      ? 'seed'
      : 'schema';

  if (mode === 'fixtures' && process.env.NODE_ENV === 'production') {
    log.error('fixtures cannot be loaded in production');
    process.exitCode = 1;
    return;
  }
  log.info('migrate starting', { mode, dir: MIGRATIONS_DIR });
  try {
    await applyMigrations(mode);
    log.info('migrate complete');
  } catch (err) {
    log.error('migrate aborted', { err: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

void main();
