import { createClient, type RedisClientType } from 'redis';
import { config } from '../../config/env';
import { logger } from '../logging/logger';

const log = logger.child('redis');
let client: RedisClientType | undefined;
let connection: Promise<RedisClientType> | undefined;

const REDIS_CONNECT_TIMEOUT_MS = 5_000;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!config.redisUrl) throw new Error('Redis is not configured');
  if (client?.isReady) return client;
  if (connection) return connection;
  const next = createClient({
    url: config.redisUrl,
    socket: {
      connectTimeout: 2_000,
      reconnectStrategy: (retries: number) => (retries >= 10 ? false : Math.min(retries * 100, 2_000)),
    },
  });
  next.on('error', (error: Error) => log.warn('redis client error', { error_type: error.name }));
  const connectPromise = next.connect().then(() => {
    client = next as RedisClientType;
    log.info('redis connected');
    return client;
  }).finally(() => {
    connection = undefined;
  });
  let deadline: NodeJS.Timeout | undefined;
  const deadlinePromise = new Promise<never>((_, reject) => {
    deadline = setTimeout(() => reject(new Error('Redis connect deadline exceeded')), REDIS_CONNECT_TIMEOUT_MS);
    deadline.unref();
  });
  connection = Promise.race([connectPromise, deadlinePromise])
    .catch(async (error: unknown) => {
      connection = undefined;
      if (next.isOpen) await next.disconnect().catch(() => undefined);
      throw error;
    })
    .finally(() => {
      if (deadline) clearTimeout(deadline);
    });
  return connection;
}

export async function withRedisDeadline<T>(operation: Promise<T>, timeoutMs = 2_000): Promise<T> {
  let deadline: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    deadline = setTimeout(() => reject(new Error('Redis command deadline exceeded')), timeoutMs);
    deadline.unref();
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (deadline) clearTimeout(deadline);
  }
}

export async function closeRedis(): Promise<void> {
  const current = client;
  client = undefined;
  connection = undefined;
  if (current?.isOpen) await current.quit();
}
