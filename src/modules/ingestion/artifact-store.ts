import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../../config/env';

type ArtifactType = 'html' | 'pdf' | 'xlsx' | 'csv' | 'json' | 'other';

export interface ArtifactStoreInput {
  sourceKey: string;
  contentHash: string;
  artifactType: ArtifactType;
  bytes: Buffer;
  date: string;
}

export interface ArtifactStore {
  put(input: ArtifactStoreInput): Promise<string>;
}

export class LocalArtifactStore implements ArtifactStore {
  constructor(private readonly rootDirectory = config.artifactLocalDir) {}

  async put(input: ArtifactStoreInput): Promise<string> {
    const digest = normalizedDigest(input.contentHash);
    assertDigest(input.bytes, digest);
    const dir = resolve(this.rootDirectory, safeSegment(input.sourceKey), input.date);
    await mkdir(dir, { recursive: true });
    const full = join(dir, `${digest}.${extensionFor(input.artifactType)}`);
    try {
      await writeFile(full, input.bytes, { flag: 'wx' });
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      assertDigest(await readFile(full), digest);
    }
    return `file://${full}`;
  }
}

export class S3ArtifactStore implements ArtifactStore {
  private readonly client = new S3Client({
    region: config.s3Region,
    endpoint: config.s3Endpoint,
    forcePathStyle: config.s3ForcePathStyle,
  });

  async put(input: ArtifactStoreInput): Promise<string> {
    const bucket = config.s3Bucket;
    if (!bucket) throw new Error('S3 bucket is not configured');
    const digest = normalizedDigest(input.contentHash);
    assertDigest(input.bytes, digest);
    const key = `${trimSlashes(config.s3Prefix)}/${safeSegment(input.sourceKey)}/${input.date}/${digest}.${extensionFor(input.artifactType)}`;
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.bytes,
        ContentType: contentTypeFor(input.artifactType),
        ChecksumSHA256: Buffer.from(digest, 'hex').toString('base64'),
        Metadata: { sha256: digest, source: input.sourceKey },
        ServerSideEncryption: config.s3Endpoint ? undefined : 'AES256',
        IfNoneMatch: '*',
      }));
    } catch (error) {
      if (!isPreconditionFailed(error)) throw error;
    }
    return `s3://${bucket}/${key}`;
  }
}

export function createArtifactStore(): ArtifactStore {
  return config.artifactStorageMode === 's3' ? new S3ArtifactStore() : new LocalArtifactStore();
}

function normalizedDigest(value: string): string {
  const digest = value.replace(/^sha256:/, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new TypeError('Artifact content hash must be SHA-256');
  return digest;
}

function assertDigest(bytes: Buffer, expected: string): void {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error('Artifact content hash mismatch');
}

function safeSegment(value: string): string {
  if (!/^[a-z0-9_-]+$/i.test(value)) throw new TypeError('Unsafe artifact path segment');
  return value;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'EEXIST');
}

function isPreconditionFailed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === 'PreconditionFailed' || candidate.$metadata?.httpStatusCode === 412;
}

function extensionFor(type: ArtifactType): string {
  return type === 'other' ? 'bin' : type;
}

function contentTypeFor(type: ArtifactType): string {
  switch (type) {
    case 'html': return 'text/html; charset=utf-8';
    case 'pdf': return 'application/pdf';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv': return 'text/csv; charset=utf-8';
    case 'json': return 'application/json';
    default: return 'application/octet-stream';
  }
}
