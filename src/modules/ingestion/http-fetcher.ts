import { createHash } from 'node:crypto';
import { config } from '../../config/env';
import { AppError } from '../../core/errors/app-error';

export interface FetchedArtifact {
  url: string;
  bytes: Buffer;
  contentType: string | null;
  status: number;
  hash: string;
}

const USER_AGENT = 'IndianFuelPriceAPI/1.0 research-contact-needed';

export async function fetchArtifact(url: string): Promise<FetchedArtifact> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    const arrayBuffer = await res.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    if (bytes.length > config.fetchMaxBytes) {
      throw new AppError('UPSTREAM_ERROR', `Artifact exceeds FETCH_MAX_BYTES for ${url}`, 502);
    }
    return {
      url,
      bytes,
      contentType: res.headers.get('content-type'),
      status: res.status,
      hash: createHash('sha256').update(bytes).digest('hex'),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('UPSTREAM_ERROR', `Failed to fetch artifact: ${url}`, 502, error instanceof Error ? { message: error.message } : undefined);
  } finally {
    clearTimeout(timer);
  }
}
