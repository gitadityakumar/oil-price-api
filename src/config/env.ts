import { AppError } from '../core/errors/app-error';

export type Env = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  apiKeyPepper: string | undefined;
  artifactStorageMode: 'local' | 's3';
  artifactLocalDir: string;
  s3Bucket: string | undefined;
  s3Region: string | undefined;
  s3Endpoint: string | undefined;
  s3ForcePathStyle: boolean;
  s3Prefix: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  ingestionLiveFetch: boolean;
  fetchTimeoutMs: number;
  fetchMaxBytes: number;
  ingestionUserAgent: string;
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new AppError('CONFIG_ERROR', `Invalid boolean value: ${value}`, 500);
}

function parsePositiveInt(value: string | undefined, fallback: number, field: string): number {
  if (!value) return fallback;
  const parsed = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError('CONFIG_ERROR', `Invalid ${field}: ${value}`, 500);
  }
  return parsed;
}

function parseNodeEnv(value: string | undefined): Env['nodeEnv'] {
  if (!value) return 'development';
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }
  throw new AppError('CONFIG_ERROR', `Invalid NODE_ENV: ${value}`, 500);
}

function parsePort(value: string | undefined): number {
  if (!value) return 8080;
  const port = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new AppError('CONFIG_ERROR', `Invalid PORT: ${value}`, 500);
  }
  return port;
}

function parseLogLevel(value: string | undefined): Env['logLevel'] {
  if (!value) return 'info';
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }
  throw new AppError('CONFIG_ERROR', `Invalid LOG_LEVEL: ${value}`, 500);
}

function parseStorageMode(value: string | undefined): Env['artifactStorageMode'] {
  if (!value) return 'local';
  if (value === 'local' || value === 's3') return value;
  throw new AppError('CONFIG_ERROR', `Invalid ARTIFACT_STORAGE_MODE: ${value}`, 500);
}

function buildConfig(): Env {
  const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
  const isTest = nodeEnv === 'test';
  const isDev = nodeEnv === 'development';

  const env: Env = {
    nodeEnv,
    port: parsePort(process.env.PORT),
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL || undefined,
    apiKeyPepper: process.env.API_KEY_PEPPER || undefined,
    artifactStorageMode: parseStorageMode(process.env.ARTIFACT_STORAGE_MODE),
    artifactLocalDir: process.env.ARTIFACT_LOCAL_DIR || './.artifacts',
    s3Bucket: process.env.S3_BUCKET || undefined,
    s3Region: process.env.S3_REGION || undefined,
    s3Endpoint: process.env.S3_ENDPOINT || undefined,
    s3ForcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE, false),
    s3Prefix: process.env.S3_PREFIX || 'oil-api/artifacts',
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    ingestionLiveFetch: parseBoolean(process.env.INGESTION_LIVE_FETCH, false),
    fetchTimeoutMs: parsePositiveInt(process.env.FETCH_TIMEOUT_MS, 15000, 'FETCH_TIMEOUT_MS'),
    fetchMaxBytes: parsePositiveInt(process.env.FETCH_MAX_BYTES, 5 * 1024 * 1024, 'FETCH_MAX_BYTES'),
    ingestionUserAgent: process.env.INGESTION_USER_AGENT || 'OilAPI/0.1 local-development',
  };

  // Required outside tests and dev.
  if (!isTest && !env.databaseUrl) {
    if (!isDev) {
      throw new AppError('CONFIG_ERROR', 'DATABASE_URL is required', 500);
    }
  }

  // API key pepper required outside dev/test.
  if (!isDev && !isTest && !env.apiKeyPepper) {
    throw new AppError('CONFIG_ERROR', 'API_KEY_PEPPER is required in production', 500);
  }

  // S3 mode mandates bucket/region.
  if (env.artifactStorageMode === 's3') {
    if (!env.s3Bucket || !env.s3Region) {
      throw new AppError('CONFIG_ERROR', 'S3_BUCKET and S3_REGION are required in s3 mode', 500);
    }
  }

  return env;
}

export const config: Env = buildConfig();
