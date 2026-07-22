import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import { generatePostmortem } from '../services/postmortemService';

/**
 * Generates (or regenerates) an AI postmortem draft and updates the cached
 * incident with the result.
 */
export function useGeneratePostmortem(incidentId: string): UseMutationResult<Incident, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => generatePostmortem(incidentId),
    onSuccess: (incident) => {
      queryClient.setQueryData(queryKeys.incident(incidentId), incident);
    },
  });
}
