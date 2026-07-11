/**
 * Dev-only middleware: POST /dev/create-api-client
 * Spawns oil-api create-api-client CLI against the configured Postgres.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const oilApiRoot = path.resolve(__dirname, '..');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function runCreateClient(args, env) {
  const distCli = path.join(oilApiRoot, 'dist', 'cli', 'create-api-client.js');
  const srcCli = path.join(oilApiRoot, 'src', 'cli', 'create-api-client.ts');

  let command;
  let commandArgs;
  if (existsSync(distCli)) {
    command = process.execPath;
    commandArgs = [distCli, ...args];
  } else if (existsSync(srcCli)) {
    command = 'npx';
    commandArgs = ['tsx', srcCli, ...args];
  } else {
    return Promise.reject(new Error('create-api-client entry not found under oil-api'));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: oilApiRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `CLI exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function parseCliOutput(stdout) {
  const clientMatch = stdout.match(/client_id:\s*(\S+)/);
  const keyMatch = stdout.match(/api_key:\s*(\S+)/);
  if (!clientMatch || !keyMatch) {
    throw new Error(`Unexpected CLI output: ${stdout.slice(0, 200)}`);
  }
  return { client_id: clientMatch[1], api_key: keyMatch[1] };
}

export function createApiClientPlugin(options = {}) {
  return {
    name: 'create-api-client-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/dev/create-api-client') {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const name = String(body.name ?? '').trim();
          if (!name) {
            sendJson(res, 400, { error: 'name is required' });
            return;
          }

          const tier = String(body.tier ?? 'free').trim() || 'free';
          const scopes = Array.isArray(body.scopes)
            ? body.scopes.map(String).map((s) => s.trim()).filter(Boolean)
            : ['read:public'];
          if (scopes.length === 0) {
            sendJson(res, 400, { error: 'at least one scope is required' });
            return;
          }

          const args = ['--name', name, '--tier', tier, '--scopes', scopes.join(',')];
          if (body.live) args.push('--live');
          if (body.rate_limit != null && body.rate_limit !== '') {
            args.push('--rate-limit', String(body.rate_limit));
          }
          if (body.quota != null && body.quota !== '') {
            args.push('--quota', String(body.quota));
          }

          const databaseUrl =
            options.databaseUrl ||
            process.env.CREATE_CLIENT_DATABASE_URL ||
            process.env.DATABASE_URL ||
            'postgres://oilapi:oilapi@localhost:55432/oilapi';

          const apiKeyPepper =
            options.apiKeyPepper ||
            process.env.CREATE_CLIENT_API_KEY_PEPPER ||
            process.env.API_KEY_PEPPER ||
            'compose-local-pepper-change-me';

          const stdout = await runCreateClient(args, {
            DATABASE_URL: databaseUrl,
            API_KEY_PEPPER: apiKeyPepper,
            NODE_ENV: process.env.NODE_ENV || 'development',
          });

          const credentials = parseCliOutput(stdout);
          sendJson(res, 201, credentials);
        } catch (err) {
          sendJson(res, 500, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    },
  };
}
