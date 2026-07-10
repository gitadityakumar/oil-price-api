import { query } from '../../db/query';

export async function getDataGeneration(namespace: string): Promise<number> {
  const result = await query<{ generation: string | number }>(
    'select generation from data_generation where namespace = $1',
    [namespace],
  );
  return Number(result.rows[0]?.generation ?? 1);
}
