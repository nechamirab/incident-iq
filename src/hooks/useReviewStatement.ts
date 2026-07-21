import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import type { ReviewStatus } from '../../shared/types/reasoning';
import { queryKeys } from '../constants/queryKeys';
import { reviewStatement } from '../services/analysisService';

interface ReviewStatementVariables {
  statementId: string;
  reviewStatus: ReviewStatus;
}

/**
 * Records a human reviewer's judgment on a fact or assumption and refreshes
 * the cached incident so the updated status appears immediately.
 */
export function useReviewStatement(incidentId: string): UseMutationResult<
  Incident,
  Error,
  ReviewStatementVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ statementId, reviewStatus }: ReviewStatementVariables) =>
      reviewStatement(incidentId, statementId, reviewStatus),
    onSuccess: (incident) => {
      queryClient.setQueryData(queryKeys.incident(incidentId), incident);
    },
  });
}
