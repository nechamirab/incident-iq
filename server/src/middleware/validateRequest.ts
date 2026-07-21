import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Express middleware factory that parses `req.body` against the given Zod
 * schema. On success, `req.body` is replaced with the parsed (defaulted)
 * value; on failure, a 400 {@link ApiError} carrying the Zod issues is
 * forwarded to the centralized error handler.
 *
 * @param schema The Zod schema `req.body` must satisfy.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new ApiError(400, 'VALIDATION_ERROR', 'The request body is invalid.', result.error.issues),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}
