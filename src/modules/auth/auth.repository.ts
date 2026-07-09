import { query } from '../../db/query';
import type { ApiClientRow, ApiClientStatus } from './auth.model';

export type CreateApiClientInput = {
  client_id: string;
  name: string;
  key_hash: string;
  tier: string;
  scopes: string[];
  rate_limit_per_minute?: number;
  quota_per_day?: number | null;
};

export interface AuthRepository {
  findClientById(clientId: string): Promise<ApiClientRow | null>;
  touchLastUsed(apiClientId: number): Promise<void>;
  getDailyUsage(apiClientId: number, usageDate: string): Promise<number>;
  incrementDailyUsage(apiClientId: number, usageDate: string): Promise<void>;
  createClient(input: CreateApiClientInput): Promise<ApiClientRow>;
}

export class PgAuthRepository implements AuthRepository {
  async findClientById(clientId: string): Promise<ApiClientRow | null> {
    const res = await query<ApiClientRow>(
      `select api_client_id, client_id, name, key_hash, status, tier,
              coalesce(scopes, array['read:public']::text[]) as scopes,
              rate_limit_per_minute, quota_per_day, created_at, updated_at, last_used_at
         from api_client
        where client_id = $1
        limit 1`,
      [clientId],
    );
    return res.rows[0] ?? null;
  }

  async touchLastUsed(apiClientId: number): Promise<void> {
    await query('update api_client set last_used_at = now(), updated_at = now() where api_client_id = $1', [apiClientId]);
  }

  async getDailyUsage(apiClientId: number, usageDate: string): Promise<number> {
    const res = await query<{ request_count: string | number }>(
      'select request_count from api_usage_daily where api_client_id = $1 and usage_date = $2::date',
      [apiClientId, usageDate],
    );
    return Number(res.rows[0]?.request_count ?? 0);
  }

  async incrementDailyUsage(apiClientId: number, usageDate: string): Promise<void> {
    await query(
      `insert into api_usage_daily (usage_date, api_client_id, request_count)
       values ($1::date, $2, 1)
       on conflict (usage_date, api_client_id)
       do update set request_count = api_usage_daily.request_count + 1`,
      [usageDate, apiClientId],
    );
  }

  async createClient(input: CreateApiClientInput): Promise<ApiClientRow> {
    const res = await query<ApiClientRow>(
      `insert into api_client
        (client_id, name, key_hash, status, tier, scopes, rate_limit_per_minute, quota_per_day)
       values ($1, $2, $3, 'active', $4, $5::text[], $6, $7)
       returning api_client_id, client_id, name, key_hash, status, tier, scopes,
                 rate_limit_per_minute, quota_per_day, created_at, updated_at, last_used_at`,
      [
        input.client_id,
        input.name,
        input.key_hash,
        input.tier,
        input.scopes,
        input.rate_limit_per_minute ?? 60,
        input.quota_per_day ?? null,
      ],
    );
    return res.rows[0];
  }
}

export class MemoryAuthRepository implements AuthRepository {
  private readonly rows = new Map<string, ApiClientRow>();
  private readonly usage = new Map<string, number>();

  constructor(rows: ApiClientRow[] = []) {
    for (const row of rows) this.rows.set(row.client_id, row);
  }

  add(row: ApiClientRow): void {
    this.rows.set(row.client_id, row);
  }

  setStatus(clientId: string, status: ApiClientStatus): void {
    const row = this.rows.get(clientId);
    if (row) row.status = status;
  }

  async findClientById(clientId: string): Promise<ApiClientRow | null> {
    return this.rows.get(clientId) ?? null;
  }

  async touchLastUsed(apiClientId: number): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.api_client_id === apiClientId) row.last_used_at = new Date().toISOString();
    }
  }

  async getDailyUsage(apiClientId: number, usageDate: string): Promise<number> {
    return this.usage.get(`${usageDate}:${apiClientId}`) ?? 0;
  }

  async incrementDailyUsage(apiClientId: number, usageDate: string): Promise<void> {
    const key = `${usageDate}:${apiClientId}`;
    this.usage.set(key, (this.usage.get(key) ?? 0) + 1);
  }

  async createClient(input: CreateApiClientInput): Promise<ApiClientRow> {
    const row: ApiClientRow = {
      api_client_id: this.rows.size + 1,
      client_id: input.client_id,
      name: input.name,
      key_hash: input.key_hash,
      status: 'active',
      tier: input.tier,
      scopes: input.scopes,
      rate_limit_per_minute: input.rate_limit_per_minute ?? 60,
      quota_per_day: input.quota_per_day ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_used_at: null,
    };
    this.add(row);
    return row;
  }
}
