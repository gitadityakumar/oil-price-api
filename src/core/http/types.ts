import type { IncomingMessage, ServerResponse } from 'node:http';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type HandlerContext = {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  requestId: string;
};

export type RouteHandler = (ctx: HandlerContext) => Promise<void> | void;

export type JsonBody = Record<string, unknown> | unknown[] | null;