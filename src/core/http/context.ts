import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthenticatedClient } from '../../modules/auth/auth.model';

export interface HttpContext {
  req: IncomingMessage;
  res: ServerResponse;
  requestId: string;
  method: string;
  path: string;
  url: URL;
  params: Record<string, string>;
  query: URLSearchParams;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  client?: AuthenticatedClient;
  startedAt: number;
  /** Internal: set by middleware/router to indicate a response was sent. */
  responded?: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type JsonBody = Record<string, unknown> | unknown[] | null;