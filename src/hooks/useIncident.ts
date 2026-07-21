import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import { fetchIncidentById } from '../services/incidentService';

/**
 * Queries a single incident by id, for the Incident Workspace page.
 */
export function useIncident(incidentId: string | undefined): UseQueryResult<Incident, Error> {
  return useQuery({
    queryKey: queryKeys.incident(incidentId ?? ''),
    queryFn: () => fetchIncidentById(incidentId ?? ''),
    enabled: Boolean(incidentId),
  });
}
