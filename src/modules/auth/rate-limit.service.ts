import { config } from '../../config/env';
import { AppError } from '../../core/errors/app-error';
import { logger } from '../../core/logging/logger';
import { getRedisClient, withRedisDeadline } from '../../core/redis/redis-client';
import { PgAuthRepository, type AuthRepository } from './auth.repository';
import type { AuthenticatedClient } from './auth.model';

const log = logger.child('rate-limit');

export type RateLimitResult = {
  limit: number;
  remaining: number;
  resetAt: number;
};

type WindowState = { count: number; resetAt: number };

const CONSUME_MINUTE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIREAT', KEYS[1], ARGV[1]) end
return count
`;

export class RateLimitService {
  private readonly windows = new Map<string, WindowState>();
  private readonly dailyUsage = new Map<string, number>();

  constructor(
    private readonly repository: AuthRepository = new PgAuthRepository(),
    private readonly useRedis = Boolean(config.redisUrl) && config.nodeEnv !== 'test',
  ) {
    if (config.nodeEnv === 'production' && !config.redisUrl) {
      throw new AppError('CONFIG_ERROR', 'REDIS_URL is required for production rate limiting');
    }
  }

  async consume(client: AuthenticatedClient, now = new Date()): Promise<RateLimitResult> {
    this.pruneMemory(now);
    const dateKey = yyyyMMdd(now);
    const daily = await this.consumeDaily(client, dateKey);
    if (!daily.allowed) {
      throw new AppError('RATE_LIMITED', 'Daily quota exceeded', 429, {
        limit: client.quota_per_day ?? 0,
        remaining: 0,
        resetAt: nextDayEpochSeconds(now),
      });
    }

    const resetAt = nextMinuteEpochSeconds(now);
    const count = this.useRedis
      ? await this.consumeRedisMinute(client, now, resetAt)
      : this.consumeMemoryMinute(client, now, resetAt);

    if (count > client.rate_limit_per_minute) {
      throw new AppError('RATE_LIMITED', 'Rate limit exceeded', 429, {
        limit: client.rate_limit_per_minute,
        remaining: 0,
        resetAt,
      });
    }

    return {
      limit: client.rate_limit_per_minute,
      remaining: Math.max(0, client.rate_limit_per_minute - count),
      resetAt,
    };
  }

  reset(): void {
    this.windows.clear();
    this.dailyUsage.clear();
  }

  private async consumeDaily(client: AuthenticatedClient, dateKey: string): Promise<{ allowed: boolean; count: number }> {
    try {
      return await this.repository.consumeDailyQuota(client.api_client_id, dateKey, client.quota_per_day);
    } catch (error) {
      if (config.nodeEnv === 'production') {
        throw new AppError('DB_ERROR', 'Daily quota store unavailable', 500, undefined, error);
      }
      const key = `${dateKey}:${client.api_client_id}`;
      const current = this.dailyUsage.get(key) ?? 0;
      if (client.quota_per_day !== null && current >= client.quota_per_day) return { allowed: false, count: current };
      const count = current + 1;
      this.dailyUsage.set(key, count);
      return { allowed: true, count };
    }
  }

  private consumeMemoryMinute(client: AuthenticatedClient, now: Date, resetAt: number): number {
    const minuteKey = `${client.client_id}:${yyyyMMddHHmm(now)}`;
    const current = this.windows.get(minuteKey);
    const state = current && current.resetAt > Math.floor(now.getTime() / 1000) ? current : { count: 0, resetAt };
    state.count += 1;
    this.windows.set(minuteKey, state);
    return state.count;
  }

  private async consumeRedisMinute(client: AuthenticatedClient, now: Date, resetAt: number): Promise<number> {
    try {
      const redis = await getRedisClient();
      const key = `rate:v1:${client.client_id}:${yyyyMMddHHmm(now)}`;
      return Number(await withRedisDeadline(redis.eval(CONSUME_MINUTE_SCRIPT, { keys: [key], arguments: [String(resetAt)] })));
    } catch (error) {
      if (config.nodeEnv === 'production') {
        throw new AppError('UPSTREAM_ERROR', 'Rate limit store unavailable', 503, undefined, error);
      }
      log.warn('redis rate limit unavailable; using local development fallback', { error_type: error instanceof Error ? error.name : typeof error });
      return this.consumeMemoryMinute(client, now, resetAt);
    }
  }

  private pruneMemory(now: Date): void {
    const epoch = Math.floor(now.getTime() / 1000);
    for (const [key, state] of this.windows) if (state.resetAt <= epoch) this.windows.delete(key);
    const currentDate = yyyyMMdd(now);
    for (const key of this.dailyUsage.keys()) if (!key.startsWith(`${currentDate}:`)) this.dailyUsage.delete(key);
  }
}

function yyyyMMddHHmm(date: Date): string {
  return date.toISOString().slice(0, 16).replace(/[-:T]/g, '');
}

function yyyyMMdd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextMinuteEpochSeconds(date: Date): number {
  const next = new Date(date);
  next.setUTCSeconds(0, 0);
  next.setUTCMinutes(next.getUTCMinutes() + 1);
  return Math.floor(next.getTime() / 1000);
}

function nextDayEpochSeconds(date: Date): number {
  const next = new Date(date);
  next.setUTCHours(24, 0, 0, 0);
  return Math.floor(next.getTime() / 1000);
}
