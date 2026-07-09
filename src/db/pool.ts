import pg from 'pg';
import { config } from '../config/env';
import { AppError } from '../core/errors/app-error';
import { logger } from '../core/logging/logger';

const log = logger.child('db');

let pool: pg.Pool | undefined;

/**
 * Singleton PostgreSQL pool created from config.databaseUrl.
 * Lazily created so early tasks/tests that do not touch the DB skip the
 * connection entirely.
 */
export function getPool(): pg.Pool {
  if (!config.databaseUrl) {
    throw new AppError('CONFIG_ERROR', 'DATABASE_URL is not configured', 500);
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

export type DbClient = pg.PoolClient;

export async function connect(): Promise<pg.PoolClient> {
  return getPool().connect();
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    log.info('postgres pool closed');
  }
}