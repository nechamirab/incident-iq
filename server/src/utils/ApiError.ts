/**
 * Controlled application error carrying an HTTP status code and a stable
 * machine-readable error code, so route handlers can throw a single error
 * type and let the centralized error middleware format the response.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
