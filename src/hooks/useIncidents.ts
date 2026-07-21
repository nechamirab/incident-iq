import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import { fetchIncidents } from '../services/incidentService';

/**
 * Queries every incident (bundled samples plus any created by the user).
 */
export function useIncidents(): UseQueryResult<Incident[], Error> {
  return useQuery({
    queryKey: queryKeys.incidents,
    queryFn: fetchIncidents,
  });
}
