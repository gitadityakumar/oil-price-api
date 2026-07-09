import { generateApiKey } from '../modules/auth/api-key-generator';
import { PgAuthRepository } from '../modules/auth/auth.repository';
import { closePool } from '../db/pool';

type Args = {
  name: string;
  tier: string;
  scopes: string[];
  rateLimit?: number;
  quota?: number | null;
  live: boolean;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const generated = generateApiKey({ env: args.live ? 'live' : 'test' });
  const repo = new PgAuthRepository();
  await repo.createClient({
    client_id: generated.client_id,
    name: args.name,
    key_hash: generated.key_hash,
    tier: args.tier,
    scopes: args.scopes,
    rate_limit_per_minute: args.rateLimit,
    quota_per_day: args.quota,
  });
  process.stdout.write(`client_id: ${generated.client_id}\napi_key: ${generated.api_key}\n`);
}

function parseArgs(argv: string[]): Args {
  const out: Args = { name: '', tier: 'free', scopes: ['read:public'], live: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--name') { out.name = requireValue(arg, next); i += 1; }
    else if (arg === '--tier') { out.tier = requireValue(arg, next); i += 1; }
    else if (arg === '--scopes') { out.scopes = requireValue(arg, next).split(',').map((s) => s.trim()).filter(Boolean); i += 1; }
    else if (arg === '--rate-limit') { out.rateLimit = Number.parseInt(requireValue(arg, next), 10); i += 1; }
    else if (arg === '--quota') { out.quota = Number.parseInt(requireValue(arg, next), 10); i += 1; }
    else if (arg === '--live') out.live = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!out.name) throw new Error('--name is required');
  return out;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

main()
  .catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void closePool();
  });
