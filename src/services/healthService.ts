import type { HealthCheckResult } from '../../shared/types/health';
import { apiRequest } from './apiClient';

/**
 * Fetches the backend health status.
 *
 * @returns The current health check result reported by the API.
 */
export async function fetchHealthStatus(): Promise<HealthCheckResult> {
  return apiRequest<HealthCheckResult>('/api/health');
}
