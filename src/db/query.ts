import type pg from 'pg';
import { getPool, type DbClient } from './pool';
import { AppError } from '../core/errors/app-error';
import { logger } from '../core/logging/logger';

const log = logger.child('query');

export type QueryResult<T extends pg.QueryResultRow = pg.QueryResultRow> = pg.QueryResult<T>;

/**
 * Typed wrapper around the pool query. Repositories should use this instead of
 * importing `pg` directly. Logs duration and maps DB errors to AppError.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const pool = getPool();
  const started = Date.now();
  try {
    const result = await pool.query<T>(text, params as pg.QueryConfigValues<unknown[]>);
    const durationMs = Date.now() - started;
    if (durationMs > 200) {
      log.warn('slow query', { text: text.slice(0, 200), duration_ms: durationMs });
    } else {
      log.debug('query', { text: text.slice(0, 120), duration_ms: durationMs, rows: result.rowCount });
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('query failed', { text: text.slice(0, 200), err: message });
    throw new AppError('DB_ERROR', message, 500, { text: text.slice(0, 200) });
  }
}

/**
 * Run a query against a specific client (used inside transactions). Does not
 * acquire a new connection from the pool.
 */
export async function queryOn<T extends pg.QueryResultRow = pg.QueryResultRow>(
  client: DbClient,
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const started = Date.now();
  try {
    const result = await client.query<T>(text, params as pg.QueryConfigValues<unknown[]>);
    const durationMs = Date.now() - started;
    log.debug('query(tx)', { text: text.slice(0, 120), duration_ms: durationMs, rows: result.rowCount });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('query(tx) failed', { text: text.slice(0, 200), err: message });
    throw new AppError('DB_ERROR', message, 500, { text: text.slice(0, 200) });
  }
}