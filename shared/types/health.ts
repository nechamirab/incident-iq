/**
 * Payload returned by `GET /api/health`, used by the frontend to confirm
 * connectivity with the backend and to display basic runtime information.
 */
export interface HealthCheckResult {
  status: 'ok';
  service: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}
