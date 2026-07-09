import pg from 'pg';
import { config } from '../config/env';
import { AppError } from '../core/errors/app-error';
import { logger } from '../core/logging/logger';

const log = logger.child('db');

let pool: pg.Pool | undefined;

/**
 * Lazily create the PostgreSQL pool. Tests/early tasks may not need a DB
 * connection, so we avoid opening one until first use.
 */
export function getPool(): pg.Pool {
  if (!config.databaseUrl && config.nodeEnv !== 'development') {
    throw new AppError('CONFIG_ERROR', 'DATABASE_URL is not configured', 500);
  }
  if (!config.databaseUrl) {
    throw new AppError('CONFIG_ERROR', 'DATABASE_URL is required to use the pool', 500);
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl });
    pool.on('error', (err) => {
      log.error('idle pool client error', { err: err.message });
    });
    log.info('postgres pool created');
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const p = getPool();
  try {
    return await p.query<T>(text, params as pg.QueryConfigValues<unknown[]>);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('query failed', { text, err: message });
    throw new AppError('DB_ERROR', message, 500, { text });
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    log.info('postgres pool closed');
  }
}