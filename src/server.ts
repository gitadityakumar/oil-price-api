import { createServer } from 'node:http';
import { config } from './config/env';
import { createApp } from './app';
import { logger } from './core/logging/logger';
import { closePool } from './db/pool';

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
  server.close((err) => {
    if (err) log.warn('server close error', { err: err.message });
    log.info('server closed');
  });
  // Stop accepting new connections; close DB pool promptly.
  setTimeout(() => {
    void closePool().finally(() => process.exit(0));
  }, 0);
  // Hard exit if something still hangs (not unref'd so it fires).
  setTimeout(() => {
    log.warn('forced_exit', { reason: 'shutdown timeout' });
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));