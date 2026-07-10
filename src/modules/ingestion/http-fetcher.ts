import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from '../../config/env';
import { AppError } from '../../core/errors/app-error';

export interface FetchPolicy {
  allowedHosts?: readonly string[];
  allowedContentTypes?: readonly string[];
  maxRedirects?: number;
  allowPrivateNetwork?: boolean;
}

export interface FetchedArtifact {
  requestedUrl: string;
  finalUrl: string;
  redirectChain: string[];
  bytes: Buffer;
  contentType: string | null;
  status: number;
  hash: string;
  fetchedAt: string;
}

export async function fetchArtifact(requestedUrl: string, policy: FetchPolicy = {}): Promise<FetchedArtifact> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  const redirectChain: string[] = [];
  const allowedHosts = new Set((policy.allowedHosts ?? [new URL(requestedUrl).hostname]).map((host) => host.toLowerCase()));
  let currentUrl = requestedUrl;
  try {
    for (let redirects = 0; redirects <= (policy.maxRedirects ?? 5); redirects += 1) {
      await validateDestination(currentUrl, allowedHosts, policy.allowPrivateNetwork ?? false);
      const response = await fetch(currentUrl, {
        headers: { 'user-agent': config.ingestionUserAgent, accept: '*/*' },
        redirect: 'manual',
        signal: controller.signal,
      });
      if (isRedirect(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirects === (policy.maxRedirects ?? 5)) throw upstreamError('Upstream redirect policy rejected the response');
        currentUrl = new URL(location, currentUrl).toString();
        redirectChain.push(currentUrl);
        continue;
      }
      if (!response.ok) throw upstreamError(`Upstream returned HTTP ${response.status}`);
      const contentType = response.headers.get('content-type');
      if (policy.allowedContentTypes?.length && !policy.allowedContentTypes.some((allowed) => contentType?.toLowerCase().startsWith(allowed.toLowerCase()))) {
        throw upstreamError('Upstream returned an unexpected content type');
      }
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > config.fetchMaxBytes) throw upstreamError('Upstream artifact exceeds the configured byte limit');
      const bytes = await readWithLimit(response, config.fetchMaxBytes, controller);
      return {
        requestedUrl,
        finalUrl: currentUrl,
        redirectChain,
        bytes,
        contentType,
        status: response.status,
        hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
        fetchedAt: new Date().toISOString(),
      };
    }
    throw upstreamError('Upstream redirect limit exceeded');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('UPSTREAM_ERROR', 'Failed to fetch upstream artifact', 502, undefined, error);
  } finally {
    clearTimeout(timer);
  }
}

async function readWithLimit(response: Response, maxBytes: number, controller: AbortController): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        controller.abort();
        throw upstreamError('Upstream artifact exceeds the configured byte limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function validateDestination(value: string, allowedHosts: Set<string>, allowPrivateNetwork: boolean): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(allowPrivateNetwork && url.protocol === 'http:')) throw upstreamError('Only HTTPS upstream URLs are allowed');
  const hostname = url.hostname.toLowerCase();
  if (!allowedHosts.has(hostname)) throw upstreamError('Upstream host is not allowlisted');
  if (allowPrivateNetwork) return;
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) throw upstreamError('Private upstream addresses are not allowed');
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function upstreamError(message: string): AppError {
  return new AppError('UPSTREAM_ERROR', message, 502);
}
