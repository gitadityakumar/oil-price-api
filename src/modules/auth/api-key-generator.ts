import { createHmac, randomBytes } from 'node:crypto';
import { config } from '../../config/env';
import type { ApiKeyEnvironment, GeneratedApiKey } from './auth.model';

export function generateClientId(prefix = 'cli'): string {
  return `${prefix}_${randomBytes(9).toString('base64url')}`;
}

export function buildApiKey(clientId: string, env: ApiKeyEnvironment = 'test'): string {
  return `ifp_${env}_${clientId}_${randomBytes(24).toString('hex')}`;
}

export function hashApiKey(apiKey: string, pepper = requiredPepper()): string {
  return createHmac('sha256', pepper).update(apiKey).digest('hex');
}

export function generateApiKey(input: {
  clientId?: string;
  clientPrefix?: string;
  env?: ApiKeyEnvironment;
  pepper?: string;
} = {}): GeneratedApiKey {
  const clientId = input.clientId ?? generateClientId(input.clientPrefix);
  const apiKey = buildApiKey(clientId, input.env ?? 'test');
  return {
    client_id: clientId,
    api_key: apiKey,
    key_hash: hashApiKey(apiKey, input.pepper ?? requiredPepper()),
  };
}

function requiredPepper(): string {
  if (config.apiKeyPepper) return config.apiKeyPepper;
  if (config.nodeEnv === 'production') {
    throw new Error('API_KEY_PEPPER is required in production');
  }
  return 'development-only-api-key-pepper';
}
