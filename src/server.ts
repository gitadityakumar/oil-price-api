import { createServer } from 'node:http';
import { config } from './config/env';
import { handleSafe } from './app';
import { logger } from './core/logging/logger';

const log = logger.child('server');

function start(): void {
  const server = createServer((req, res) => handleSafe(req, res));

  server.on('error', (err) => {
    log.error('server error', { err: err.message });
    process.exit(1);
  });

  server.listen(config.port, () => {
    log.info('listening', { port: config.port, env: config.nodeEnv });
  });

  const shutdown = (signal: string): void => {
    log.info('shutting down', { signal });
    server.close(() => {
      process.exit(0);
    });
    // Force exit if connections hang.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();