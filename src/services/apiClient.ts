import type { ApiResponse } from '../../shared/types/apiResponse';

/**
 * Base URL of the IncidentIQ backend API.
 * Configured via `VITE_API_BASE_URL`; defaults to the local dev server.
 */
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4001';

/**
 * Error thrown when the API responds with `success: false`, or when the
 * response cannot be parsed as the expected envelope shape.
 */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Performs a request against the IncidentIQ API and unwraps the standard
 * `ApiResponse` envelope, throwing an {@link ApiRequestError} on failure.
 *
 * @param path Path relative to the API base URL, e.g. `/api/health`.
 * @param init Optional fetch request configuration.
 * @returns The unwrapped `data` payload from a successful response.
 */
export async function apiRequest<TData>(path: string, init?: RequestInit): Promise<TData> {
  let response: Response;

  const isFormData = init?.body instanceof FormData;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        // FormData requests must not set Content-Type: the browser needs to
        // add its own multipart boundary parameter.
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
      ...init,
    });
  } catch (cause) {
    throw new ApiRequestError(
      'NETWORK_ERROR',
      'Unable to reach the IncidentIQ API. Is the backend server running?',
      cause,
    );
  }

  let body: ApiResponse<TData> | undefined;

  try {
    body = (await response.json()) as ApiResponse<TData>;
  } catch (cause) {
    throw new ApiRequestError(
      'INVALID_RESPONSE',
      'The server returned a response that could not be parsed.',
      cause,
    );
  }

  if (!response.ok || !body.success || body.data === null) {
    throw new ApiRequestError(
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.message ?? 'The request failed for an unknown reason.',
      body.error?.details,
    );
  }

  return body.data;
}
