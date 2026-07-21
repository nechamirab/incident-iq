import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const MULTER_ERROR_MESSAGES: Partial<Record<MulterError['code'], string>> = {
  LIMIT_FILE_SIZE: 'One of the uploaded files is too large.',
  LIMIT_FILE_COUNT: 'Too many files were uploaded.',
  LIMIT_UNEXPECTED_FILE: 'An unexpected file field was uploaded.',
};

interface ResolvedError {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

function resolveError(err: unknown): ResolvedError {
  if (err instanceof ApiError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message, details: err.details };
  }

  if (err instanceof MulterError) {
    return {
      statusCode: 400,
      code: `FILE_UPLOAD_${err.code}`,
      message: MULTER_ERROR_MESSAGES[err.code] ?? err.message,
      details: undefined,
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred while processing the request.',
    details: err instanceof Error ? err.stack : undefined,
  };
}

/**
 * Centralized Express error-handling middleware. Converts any thrown error
 * into the standard `ApiResponse` error envelope and never leaks a stack
 * trace to the client outside development mode.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);

  const resolved = resolveError(err);

  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code: resolved.code,
      message: resolved.message,
      details: config.nodeEnv !== 'production' ? resolved.details : undefined,
    },
  };

  res.status(resolved.statusCode).json(body);
}
