import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../../config/env';

export interface ArtifactStore {
  put(input: {
    sourceKey: string;
    contentHash: string;
    artifactType: 'html' | 'pdf' | 'xlsx' | 'csv' | 'json' | 'other';
    bytes: Buffer;
    date: string;
  }): Promise<string>;
}

class LocalArtifactStore implements ArtifactStore {
  async put(input: { sourceKey: string; contentHash: string; artifactType: 'html' | 'pdf' | 'xlsx' | 'csv' | 'json' | 'other'; bytes: Buffer; date: string; }): Promise<string> {
    const ext = extensionFor(input.artifactType);
    const dir = join(config.artifactLocalDir, input.sourceKey, input.date);
    await mkdir(dir, { recursive: true });
    const file = `${input.contentHash}.${ext}`;
    const full = join(dir, file);
    await writeFile(full, input.bytes);
    return `file://${full}`;
  }
}

class S3ArtifactStore implements ArtifactStore {
  async put(_input: { sourceKey: string; contentHash: string; artifactType: 'html' | 'pdf' | 'xlsx' | 'csv' | 'json' | 'other'; bytes: Buffer; date: string; }): Promise<string> {
    throw new Error('S3 artifact store requires a dedicated S3 client integration');
  }
}

export function createArtifactStore(): ArtifactStore {
  return config.artifactStorageMode === 's3' ? new S3ArtifactStore() : new LocalArtifactStore();
}

function extensionFor(type: string): string {
  switch (type) {
    case 'html': return 'html';
    case 'pdf': return 'pdf';
    case 'xlsx': return 'xlsx';
    case 'csv': return 'csv';
    case 'json': return 'json';
    default: return 'bin';
  }
}
