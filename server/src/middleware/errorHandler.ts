import type { NextFunction, Request, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

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

  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;
  const code = isApiError ? err.code : 'INTERNAL_ERROR';
  const message = isApiError
    ? err.message
    : 'An unexpected error occurred while processing the request.';

  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code,
      message,
      details:
        config.nodeEnv !== 'production'
          ? (isApiError ? err.details : undefined) ?? (err instanceof Error ? err.stack : undefined)
          : undefined,
    },
  };

  res.status(statusCode).json(body);
}
