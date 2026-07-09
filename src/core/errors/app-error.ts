export type AppErrorCode =
  | 'CONFIG_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'UPSTREAM_ERROR'
  | 'DB_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL_ERROR';

export const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  CONFIG_ERROR: 500,
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  AUTH_INVALID: 401,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  FORBIDDEN: 403,
  CONFLICT: 409,
  UPSTREAM_ERROR: 502,
  DB_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(code: AppErrorCode, message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode ?? STATUS_BY_CODE[code];
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static fromUnknown(error: unknown): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof Error) {
      return new AppError('INTERNAL_ERROR', error.message);
    }
    return new AppError('INTERNAL_ERROR', 'An unexpected error occurred');
  }
}