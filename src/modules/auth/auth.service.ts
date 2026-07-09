import { timingSafeEqual } from 'node:crypto';
import { config } from '../../config/env';
import { AppError } from '../../core/errors/app-error';
import { hashApiKey } from './api-key-generator';
import { PgAuthRepository, type AuthRepository } from './auth.repository';
import type { ApiClientRow, AuthenticatedClient } from './auth.model';

export type ParsedApiCredentials = {
  clientId: string;
  apiKey: string;
};

export class AuthService {
  constructor(
    private readonly repository: AuthRepository = new PgAuthRepository(),
    private readonly pepper = config.apiKeyPepper || 'development-only-api-key-pepper',
  ) {
    if (config.nodeEnv === 'production' && !config.apiKeyPepper) {
      throw new AppError('CONFIG_ERROR', 'API_KEY_PEPPER is required in production');
    }
  }

  parseCredentials(headers: Record<string, string | string[] | undefined>): ParsedApiCredentials | null {
    const authorization = headerValue(headers.authorization);
    if (authorization?.startsWith('Bearer ')) {
      const apiKey = authorization.slice('Bearer '.length).trim();
      const clientId = parseClientIdFromApiKey(apiKey);
      return clientId ? { clientId, apiKey } : null;
    }

    const clientId = headerValue(headers['x-client-id']);
    const apiKey = headerValue(headers['x-api-key']);
    if (clientId && apiKey) return { clientId, apiKey };
    return null;
  }

  async authenticate(headers: Record<string, string | string[] | undefined>): Promise<AuthenticatedClient> {
    const credentials = this.parseCredentials(headers);
    if (!credentials) {
      throw new AppError('AUTH_REQUIRED', 'API key is required', 401);
    }

    const row = await this.repository.findClientById(credentials.clientId);
    if (!row || row.status !== 'active') {
      throw new AppError('AUTH_INVALID', 'Invalid API key', 401);
    }

    if (!safeHashEquals(hashApiKey(credentials.apiKey, this.pepper), row.key_hash)) {
      throw new AppError('AUTH_INVALID', 'Invalid API key', 401);
    }

    void this.repository.touchLastUsed(row.api_client_id).catch(() => undefined);
    return toAuthenticatedClient(row);
  }
}

export function parseClientIdFromApiKey(apiKey: string): string | null {
  const match = /^ifp_(live|test)_([a-zA-Z0-9_-]+(?:_[a-zA-Z0-9_-]+)*)_[a-zA-Z0-9_-]+$/.exec(apiKey);
  return match?.[2] ?? null;
}

export function safeHashEquals(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  if (left.length !== right.length) {
    const max = Math.max(left.length, right.length, 1);
    timingSafeEqual(pad(left, max), pad(right, max));
    return false;
  }
  return timingSafeEqual(left, right);
}

function pad(buf: Buffer, len: number): Buffer {
  if (buf.length === len) return buf;
  const out = Buffer.alloc(len);
  buf.copy(out);
  return out;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toAuthenticatedClient(row: ApiClientRow): AuthenticatedClient {
  return {
    api_client_id: Number(row.api_client_id),
    client_id: row.client_id,
    name: row.name,
    tier: row.tier,
    scopes: row.scopes ?? ['read:public'],
    rate_limit_per_minute: Number(row.rate_limit_per_minute),
    quota_per_day: row.quota_per_day === null ? null : Number(row.quota_per_day),
  };
}
