import { createServer } from 'node:http';
import { config } from './config/env';
import { createApp } from './app';
import { logger } from './core/logging/logger';
import { closePool } from './db/pool';
import { closeRedis } from './core/redis/redis-client';

const log = logger.child('server');

const app = createApp();
const server = createServer((req, res) => {
  app.handle(req, res).catch((err) => {
    log.error('server handle error', { err: err instanceof Error ? err.message : String(err) });
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end();
    }
  });
});

server.on('error', (err) => {
  log.error('server error', { err: err.message });
  process.exit(1);
});

server.listen(config.port, () => {
  log.info('server_started', { port: config.port, env: config.nodeEnv });
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('shutting_down', { signal });
  const deadline = setTimeout(() => {
    log.warn('forced_exit', { reason: 'shutdown timeout' });
    server.closeAllConnections?.();
    process.exit(1);
  }, 10_000);
  try {
    server.closeIdleConnections?.();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    log.info('server closed');
    await closeRedis();
    await closePool();
    clearTimeout(deadline);
    process.exitCode = 0;
  } catch (error) {
    clearTimeout(deadline);
    log.error('graceful shutdown failed', { error_type: error instanceof Error ? error.name : typeof error });
    process.exitCode = 1;
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
