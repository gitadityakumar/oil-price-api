import { config } from '../../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogContext = Record<string, unknown> & {
  request_id?: string;
  module?: string;
};

function shouldEmit(level: LogLevel): boolean {
  return ORDER[level] >= ORDER[config.logLevel];
}

function emit(level: LogLevel, message: string, ctx: LogContext = {}): void {
  if (!shouldEmit(level)) return;
  const line = {
    level,
    time: new Date().toISOString(),
    message,
    request_id: ctx.request_id,
    module: ctx.module,
    ...stripWellKnown(ctx),
  };
  const out = JSON.stringify(line);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(out + '\n');
  } else {
    process.stdout.write(out + '\n');
  }
}

function stripWellKnown(ctx: LogContext): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (k === 'request_id' || k === 'module' || k === 'level' || k === 'time' || k === 'message') continue;
    if (v !== undefined) rest[k] = v;
  }
  return rest;
}

export const logger = {
  debug: (message: string, ctx?: LogContext) => emit('debug', message, ctx ?? {}),
  info: (message: string, ctx?: LogContext) => emit('info', message, ctx ?? {}),
  warn: (message: string, ctx?: LogContext) => emit('warn', message, ctx ?? {}),
  error: (message: string, ctx?: LogContext) => emit('error', message, ctx ?? {}),
  child: (module: string) => ({
    debug: (m: string, ctx?: LogContext) => emit('debug', m, { ...(ctx ?? {}), module }),
    info: (m: string, ctx?: LogContext) => emit('info', m, { ...(ctx ?? {}), module }),
    warn: (m: string, ctx?: LogContext) => emit('warn', m, { ...(ctx ?? {}), module }),
    error: (m: string, ctx?: LogContext) => emit('error', m, { ...(ctx ?? {}), module }),
  }),
};