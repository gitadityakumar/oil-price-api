import { connect, type DbClient } from './pool';
import { queryOn } from './query';
import { AppError } from '../core/errors/app-error';
import { logger } from '../core/logging/logger';

const log = logger.child('tx');

/**
 * Run a query within the transaction's client. Repositories call this as
 * `query(text, params)` without passing the client.
 */
export type TxQuery = <T extends { rows: unknown[] } = { rows: Record<string, unknown>[] }>(
  text: string,
  params?: unknown[],
) => Promise<{ rows: T['rows']; rowCount: number }>;

/**
 * Open a pooled client, BEGIN, run `fn`, COMMIT on success / ROLLBACK on error.
 * The client is released in a finally block. Repositories use this instead of
 * importing `pg` directly.
 */
export async function withTransaction<T>(
  fn: (tx: { client: DbClient; query: TxQuery }) => Promise<T>,
): Promise<T> {
  const client = await connect();
  let released = false;
  try {
    await client.query('BEGIN');
    const txQuery: TxQuery = (text, params) => queryOn(client, text, params) as Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
    let result: T;
    try {
      result = await fn({ client, query: txQuery });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        log.error('rollback failed', { err: rbErr instanceof Error ? rbErr.message : String(rbErr) });
      }
      throw err;
    }
    await client.query('COMMIT');
    return result;
  } finally {
    if (!released) {
      client.release();
      released = true;
    }
  }
}

export { AppError };