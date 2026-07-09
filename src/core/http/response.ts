import type { ServerResponse } from 'node:http';
import type { JsonBody } from './types';

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: JsonBody,
): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(payload).toString());
  res.end(payload);
}

export function sendOk(res: ServerResponse, body: JsonBody = { status: 'ok' }): void {
  sendJson(res, 200, body);
}

export function sendError(
  res: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  sendJson(res, statusCode, { error: { code, message, details } });
}