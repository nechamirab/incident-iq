import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import { editPostmortem, type PostmortemContent } from '../services/postmortemService';

/**
 * Saves a human reviewer's edits to an existing postmortem draft and
 * updates the cached incident with the result.
 */
export function useEditPostmortem(
  incidentId: string,
): UseMutationResult<Incident, Error, Partial<PostmortemContent>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<PostmortemContent>) => editPostmortem(incidentId, patch),
    onSuccess: (incident) => {
      queryClient.setQueryData(queryKeys.incident(incidentId), incident);
    },
  });
}
