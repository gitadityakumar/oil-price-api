/**
 * Auth module domain + persistence types.
 */

export type ApiClientStatus = 'active' | 'disabled' | 'revoked';

export type ApiClientRow = {
  api_client_id: number;
  client_id: string;
  name: string;
  key_hash: string;
  status: ApiClientStatus;
  tier: string;
  scopes: string[];
  rate_limit_per_minute: number;
  quota_per_day: number | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

export type ApiUsageDailyRow = {
  usage_date: string;
  api_client_id: number;
  request_count: number;
};

/** Client resolved by the auth middleware; attached to HttpContext. */
export type AuthenticatedClient = {
  api_client_id: number;
  client_id: string;
  name: string;
  tier: string;
  scopes: string[];
  rate_limit_per_minute: number;
  quota_per_day: number | null;
};

export type ApiKeyEnvironment = 'live' | 'test';

export type GeneratedApiKey = {
  client_id: string;
  api_key: string;
  key_hash: string;
};
