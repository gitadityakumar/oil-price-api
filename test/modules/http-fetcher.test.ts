import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchArtifact } from '../../src/modules/ingestion/http-fetcher';
import { LocalArtifactStore } from '../../src/modules/ingestion/artifact-store';

test('fetcher streams allowed content and rejects status, redirects, and oversized bodies', async () => {
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
  let port = 0;
  const server = createServer((request, response) => {
    if (request.url === '/ok') {
      response.writeHead(200, { 'content-type': 'text/html', 'content-length': '2' });
      response.end('ok');
      return;
    }
    if (request.url === '/redirect') {
      response.writeHead(302, { location: `http://localhost:${port}/ok` });
      response.end();
      return;
    }
    if (request.url === '/large') {
      response.writeHead(200, { 'content-type': 'text/html', 'content-length': String(oversized.length) });
      response.end(oversized);
      return;
    }
    response.writeHead(500, { 'content-type': 'text/plain' });
    response.end('failure');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not bind');
  port = address.port;
  const origin = `http://127.0.0.1:${port}`;
  try {
    const fetched = await fetchArtifact(`${origin}/ok`, {
      allowedHosts: ['127.0.0.1'],
      allowedContentTypes: ['text/html'],
      allowPrivateNetwork: true,
    });
    assert.equal(fetched.bytes.toString(), 'ok');
    assert.match(fetched.hash, /^sha256:[a-f0-9]{64}$/);
    await assert.rejects(() => fetchArtifact(`${origin}/failure`, { allowedHosts: ['127.0.0.1'], allowPrivateNetwork: true }), { code: 'UPSTREAM_ERROR' });
    await assert.rejects(() => fetchArtifact(`${origin}/redirect`, { allowedHosts: ['127.0.0.1'], allowPrivateNetwork: true }), { code: 'UPSTREAM_ERROR' });
    await assert.rejects(() => fetchArtifact(`${origin}/large`, { allowedHosts: ['127.0.0.1'], allowPrivateNetwork: true }), { code: 'UPSTREAM_ERROR' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('local artifact storage is immutable and hash-addressed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oil-api-artifact-'));
  try {
    const bytes = Buffer.from('immutable evidence');
    const digest = createHash('sha256').update(bytes).digest('hex');
    const store = new LocalArtifactStore(directory);
    const first = await store.put({ sourceKey: 'fixture', contentHash: `sha256:${digest}`, artifactType: 'html', bytes, date: '2026-07-10' });
    const second = await store.put({ sourceKey: 'fixture', contentHash: `sha256:${digest}`, artifactType: 'html', bytes, date: '2026-07-10' });
    assert.equal(first, second);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
