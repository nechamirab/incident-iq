import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import { updateSkepticReviewNotes } from '../services/analysisService';

interface UpdateSkepticReviewNotesVariables {
  reviewId: string;
  humanNotes: string;
}

/**
 * Records a human reviewer's own notes on a skeptic review and refreshes
 * the cached incident so the updated notes appear immediately.
 */
export function useUpdateSkepticReviewNotes(
  incidentId: string,
): UseMutationResult<Incident, Error, UpdateSkepticReviewNotesVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, humanNotes }: UpdateSkepticReviewNotesVariables) =>
      updateSkepticReviewNotes(incidentId, reviewId, humanNotes),
    onSuccess: (incident) => {
      queryClient.setQueryData(queryKeys.incident(incidentId), incident);
    },
  });
}
