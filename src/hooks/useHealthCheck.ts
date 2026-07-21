import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { HealthCheckResult } from '../../shared/types/health';
import { queryKeys } from '../constants/queryKeys';
import { fetchHealthStatus } from '../services/healthService';

/**
 * Queries the backend `/api/health` endpoint and exposes its loading,
 * error, and data state for display in the UI.
 */
export function useHealthCheck(): UseQueryResult<HealthCheckResult, Error> {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealthStatus,
    retry: 1,
  });
}
