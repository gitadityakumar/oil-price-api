/**
 * Minimal path-pattern matcher.
 * Supports static segments and `:param` capture. No wildcards/regex yet.
 *
 * Examples:
 *   pattern /v1/sources/:id  matches /v1/sources/42  -> { id: '42' }
 *   pattern /v1/health        matches /v1/health        -> {}
 */

export interface CompiledPattern {
  segments: string[]; // static text or ':param'
  paramNames: string[];
}

export function compilePattern(pattern: string): CompiledPattern {
  const clean = normalize(pattern);
  const segments = clean === '' ? [] : clean.split('/');
  const paramNames: string[] = [];
  for (const seg of segments) {
    if (isParam(seg)) paramNames.push(seg.slice(1));
  }
  return { segments, paramNames };
}

export interface MatchResult {
  matched: boolean;
  params: Record<string, string>;
}

export function matchPattern(compiled: CompiledPattern, path: string): MatchResult {
  const cleanPath = normalize(path);
  const pathSegments = cleanPath === '' ? [] : cleanPath.split('/');
  const params: Record<string, string> = {};

  if (pathSegments.length !== compiled.segments.length) {
    return { matched: false, params };
  }

  for (let i = 0; i < compiled.segments.length; i++) {
    const pat = compiled.segments[i];
    const val = pathSegments[i];
    if (isParam(pat)) {
      params[pat.slice(1)] = decodeURIComponent(val);
    } else if (pat !== val) {
      return { matched: false, params };
    }
  }
  return { matched: true, params };
}

export function normalizePath(path: string): string {
  return normalize(path);
}

function normalize(path: string): string {
  if (!path) return '';
  let p = path;
  if (p.startsWith('/')) p = p.slice(1);
  if (p.endsWith('/') && p.length > 0) p = p.slice(0, -1);
  return p;
}

function isParam(seg: string): boolean {
  return seg.startsWith(':') && seg.length > 1;
}