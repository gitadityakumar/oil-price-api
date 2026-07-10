import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type PackageMetadata = { version?: unknown };

const metadata = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as PackageMetadata;

export const SERVICE_VERSION = typeof metadata.version === 'string' ? metadata.version : '0.0.0';
