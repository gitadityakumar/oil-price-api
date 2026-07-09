import { Socket } from 'node:net';
import { config } from '../../config/env';
import { AppError } from '../../core/errors/app-error';
import { logger } from '../../core/logging/logger';
import { PgAuthRepository, type AuthRepository } from './auth.repository';
import type { AuthenticatedClient } from './auth.model';

const log = logger.child('rate-limit');

export type RateLimitResult = {
  limit: number;
  remaining: number;
  resetAt: number;
};

type WindowState = {
  count: number;
  resetAt: number;
};

export class RateLimitService {
  private readonly windows = new Map<string, WindowState>();
  private readonly dailyUsage = new Map<string, number>();
  private warnedMemoryProduction = false;

  constructor(private readonly repository: AuthRepository = new PgAuthRepository()) {
    if (config.redisUrl) {
      log.info('redis rate limit adapter configured');
    }
    if (config.nodeEnv === 'production' && !config.redisUrl) {
      this.warnProductionMemory();
    }
  }

  async consume(client: AuthenticatedClient, now = new Date()): Promise<RateLimitResult> {
    if (config.nodeEnv === 'production' && !config.redisUrl) this.warnProductionMemory();

    const dateKey = yyyyMMdd(now);
    const usage = await this.getDailyUsage(client, dateKey);
    if (client.quota_per_day !== null && usage >= client.quota_per_day) {
      throw new AppError('RATE_LIMITED', 'Daily quota exceeded', 429);
    }

    const resetAt = nextMinuteEpochSeconds(now);
    const count = config.redisUrl
      ? await this.consumeRedisMinute(client, now, resetAt)
      : this.consumeMemoryMinute(client, now, resetAt);

    if (count > client.rate_limit_per_minute) {
      throw new AppError('RATE_LIMITED', 'Rate limit exceeded', 429);
    }

    await this.incrementDailyUsage(client, dateKey);
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

  private async getDailyUsage(client: AuthenticatedClient, dateKey: string): Promise<number> {
    try {
      return await this.repository.getDailyUsage(client.api_client_id, dateKey);
    } catch {
      return this.dailyUsage.get(`${dateKey}:${client.api_client_id}`) ?? 0;
    }
  }

  private async incrementDailyUsage(client: AuthenticatedClient, dateKey: string): Promise<void> {
    const key = `${dateKey}:${client.api_client_id}`;
    this.dailyUsage.set(key, (this.dailyUsage.get(key) ?? 0) + 1);
    try {
      await this.repository.incrementDailyUsage(client.api_client_id, dateKey);
    } catch {
      // Local/test fallback is best-effort memory.
    }
  }

  private warnProductionMemory(): void {
    if (this.warnedMemoryProduction) return;
    this.warnedMemoryProduction = true;
    log.warn('memory rate limiter active in production without REDIS_URL');
  }

  private consumeMemoryMinute(client: AuthenticatedClient, now: Date, resetAt: number): number {
    const minuteKey = `${client.client_id}:${yyyyMMddHHmm(now)}`;
    const current = this.windows.get(minuteKey);
    const state = current && current.resetAt > Math.floor(now.getTime() / 1000)
      ? current
      : { count: 0, resetAt };
    state.count += 1;
    this.windows.set(minuteKey, state);
    return state.count;
  }

  private async consumeRedisMinute(client: AuthenticatedClient, now: Date, resetAt: number): Promise<number> {
    try {
      const key = `rate:v1:${client.client_id}:${yyyyMMddHHmm(now)}`;
      const count = Number(await redisCommand(config.redisUrl!, ['INCR', key]));
      if (count === 1) {
        await redisCommand(config.redisUrl!, ['EXPIREAT', key, String(resetAt)]);
      }
      return count;
    } catch (err) {
      log.warn('redis rate limit failed; using memory fallback', { err: err instanceof Error ? err.message : String(err) });
      return this.consumeMemoryMinute(client, now, resetAt);
    }
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

async function redisCommand(redisUrl: string, args: string[]): Promise<string> {
  const url = new URL(redisUrl);
  if (url.protocol !== 'redis:') throw new Error(`Unsupported Redis URL protocol: ${url.protocol}`);
  const port = url.port ? Number.parseInt(url.port, 10) : 6379;
  const host = url.hostname || '127.0.0.1';
  const commands: string[][] = [];
  if (url.password) commands.push(['AUTH', decodeURIComponent(url.password)]);
  if (url.pathname && url.pathname !== '/') commands.push(['SELECT', url.pathname.slice(1)]);
  commands.push(args);
  const payload = commands.map(encodeRedisCommand).join('');

  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let buffer = '';
    let replies = 0;
    socket.setTimeout(500);
    socket.once('error', reject);
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('Redis command timed out'));
    });
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      while (buffer.length > 0) {
        const parsed = parseRedisReply(buffer);
        if (!parsed) return;
        buffer = buffer.slice(parsed.bytes);
        replies += 1;
        if (parsed.error) {
          socket.end();
          reject(new Error(parsed.error));
          return;
        }
        if (replies === commands.length) {
          socket.end();
          resolve(parsed.value);
          return;
        }
      }
    });
    socket.connect(port, host, () => socket.write(payload));
  });
}

function encodeRedisCommand(args: string[]): string {
  return `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join('')}`;
}

function parseRedisReply(input: string): { value: string; bytes: number; error?: string } | null {
  const end = input.indexOf('\r\n');
  if (end === -1) return null;
  const prefix = input[0];
  const line = input.slice(1, end);
  if (prefix === '+' || prefix === ':') return { value: line, bytes: end + 2 };
  if (prefix === '-') return { value: '', bytes: end + 2, error: line };
  if (prefix === '$') {
    const len = Number.parseInt(line, 10);
    if (len < 0) return { value: '', bytes: end + 2 };
    const total = end + 2 + len + 2;
    if (input.length < total) return null;
    return { value: input.slice(end + 2, end + 2 + len), bytes: total };
  }
  return { value: line, bytes: end + 2 };
}
