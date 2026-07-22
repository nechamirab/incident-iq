import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import { addEvidenceItem, type AddEvidenceItemPayload } from '../services/evidenceService';

/**
 * Adds a single evidence item to an incident and writes the server's
 * response (the whole updated incident, including the new item) straight
 * into the incident's cache entry, so the Evidence tab reflects it
 * immediately without waiting on a refetch -- the same pattern
 * `useGeneratePostmortem`/`useRunSkepticReview` already use.
 */
export function useAddEvidence(
  incidentId: string,
): UseMutationResult<Incident, Error, AddEvidenceItemPayload> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddEvidenceItemPayload) => addEvidenceItem(incidentId, payload),
    onSuccess: (incident) => {
      queryClient.setQueryData(queryKeys.incident(incidentId), incident);
    },
  });
}
