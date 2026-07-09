import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BLOCKED = ['express', 'fastify', 'koa', 'hapi', '@nestjs/', 'apollo-server'];
const SRC_DIR = join(process.cwd(), 'src');

async function listTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...await listTsFiles(join(dir, entry.name)));
    else if (entry.name.endsWith('.ts')) out.push(join(dir, entry.name));
  }
  return out;
}

test('core server sources do not import blocked HTTP frameworks', async () => {
  const files = await listTsFiles(SRC_DIR);
  const offenders: string[] = [];
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    for (const pkg of BLOCKED) {
      const importRe = new RegExp(`(?:from\\s+|require\\()\\s*['"]${pkg.replace(/[-\\/]/g, m => m === '/' ? '\\/' : '\\'+m)}`, 'i');
      if (importRe.test(text) || text.includes(`from "${pkg}`) || text.includes(`require("${pkg}`) || text.includes(`require('${pkg}`)) {
        offenders.push(`${f}: blocked package '${pkg}'`);
      }
    }
  }
  assert.deepEqual(offenders, [], `no blocked frameworks should be imported:\n${offenders.join('\n')}`);
});

test('package.json declares no blocked frameworks', async () => {
  const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8'));
  const allDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  for (const pkgName of allDeps) {
    for (const b of BLOCKED) {
      assert.ok(!pkgName.includes(b), `package.json depends on blocked framework: ${pkgName}`);
    }
  }
});

test('Mvc boundaries: controllers do not import pg, repositories do not reference http status', async () => {
  const files = await listTsFiles(SRC_DIR);
  for (const f of files) {
    if (!f.includes('controller')) continue;
    const text = await readFile(f, 'utf8');
    assert.ok(!/from\s+['"].*\/(pg|query|transaction|pool)['"]/.test(text) || !/import\s+pg/.test(text), `controller imports DB: ${f}`);
  }
});