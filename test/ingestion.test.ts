import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSourceAdapter } from '../src/modules/ingestion/source-registry';
import type { CapturedArtifact, IngestionContext } from '../src/modules/ingestion/source-adapter';

test('task10 ingestion: liquid and gas fixture adapters parse facts', async () => {
  const liquid = getSourceAdapter('ppac_rsp');
  const gas = getSourceAdapter('igl_prices');
  assert.ok(liquid);
  assert.ok(gas);

  const liquidHtml = await readFile(join(process.cwd(), 'fixtures/ingestion/ppac_rsp/current.html'), 'utf8');
  const gasHtml = await readFile(join(process.cwd(), 'fixtures/ingestion/igl_prices/current.html'), 'utf8');
  const ctx: IngestionContext = {
    sourceKey: 'ppac_rsp',
    mode: 'fixture',
    now: new Date('2026-07-09T00:00:00.000Z'),
    liveFetch: false,
  };
  assert.ok((await liquid!.parseArtifact(artifact('ppac_rsp', liquidHtml), ctx)).length > 0);
  assert.ok((await gas!.parseArtifact(artifact('igl_prices', gasHtml), { ...ctx, sourceKey: 'igl_prices' })).length > 0);

  const hashA = createHash('sha256').update(liquidHtml).digest('hex');
  const hashB = createHash('sha256').update(liquidHtml).digest('hex');
  assert.equal(hashA, hashB);
});

function artifact(sourceKey: string, html: string): CapturedArtifact {
  const bytes = Buffer.from(html);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  return {
    artifactId: 1,
    sourceKey,
    artifactType: 'html',
    originalUrl: `fixture://${sourceKey}/current.html`,
    bytes,
    contentHash,
    capturedAt: '2026-07-09T00:00:00.000Z',
    storageUri: `fixture://${contentHash}`,
    metadata: {},
  };
}
