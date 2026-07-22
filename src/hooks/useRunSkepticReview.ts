import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { SkepticReview } from '../../shared/types/skepticReview';
import { queryKeys } from '../constants/queryKeys';
import { runSkepticReview } from '../services/analysisService';

/**
 * Triggers a skeptic review of an incident's latest analysis run and
 * refreshes the cached incident afterward so the new review appears.
 */
export function useRunSkepticReview(incidentId: string): UseMutationResult<SkepticReview, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => runSkepticReview(incidentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.incident(incidentId) });
    },
  });
}
