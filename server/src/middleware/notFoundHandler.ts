import type { Request, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';

/**
 * Handles requests that did not match any registered route.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}.`,
    },
  };

  res.status(404).json(body);
}
