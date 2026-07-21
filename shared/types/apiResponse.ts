/**
 * Standard error payload returned by the API when a request fails.
 */
export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Canonical response envelope used by every IncidentIQ API endpoint.
 * Exactly one of `data` or `error` is populated, depending on `success`.
 */
export interface ApiResponse<TData> {
  success: boolean;
  data: TData | null;
  error: ApiErrorPayload | null;
}
