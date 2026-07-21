import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import { fetchSampleIncidents } from '../services/incidentService';

/**
 * Queries only the bundled preset sample incidents, for "Load sample
 * incident". Never includes a user-created incident, even one whose
 * scenarioType happens to be non-`custom`.
 */
export function useSampleIncidents(): UseQueryResult<Incident[], Error> {
  return useQuery({
    queryKey: queryKeys.sampleIncidents,
    queryFn: fetchSampleIncidents,
  });
}
