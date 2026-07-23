import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import {
  updateHypothesisStatus,
  type UpdateHypothesisStatusPayload,
} from '../services/analysisService';
import { applyOptimisticHypothesisStatusUpdate } from '../utils/applyOptimisticHypothesisStatusUpdate';

interface UpdateHypothesisStatusVariables {
  hypothesisId: string;
  payload: UpdateHypothesisStatusPayload;
}

interface UpdateHypothesisStatusContext {
  previousIncident: Incident | undefined;
}

/**
 * Records a human reviewer's judgment on a hypothesis (including
 * confirming it as human-verified) with an optimistic cache update: the
 * cached incident is updated immediately so the Hypotheses tab reflects
 * the new status without waiting on the network, rolled back automatically
 * if the request fails, and re-synced with the server once the request
 * settles.
 */
export function useUpdateHypothesisStatus(
  incidentId: string,
): UseMutationResult<Incident, Error, UpdateHypothesisStatusVariables, UpdateHypothesisStatusContext> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ hypothesisId, payload }: UpdateHypothesisStatusVariables) =>
      updateHypothesisStatus(incidentId, hypothesisId, payload),

    onMutate: async ({ hypothesisId, payload }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.incident(incidentId) });

      const previousIncident = queryClient.getQueryData<Incident>(queryKeys.incident(incidentId));

      if (previousIncident) {
        queryClient.setQueryData<Incident>(
          queryKeys.incident(incidentId),
          applyOptimisticHypothesisStatusUpdate(previousIncident, hypothesisId, payload),
        );
      }

      return { previousIncident };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousIncident) {
        queryClient.setQueryData(queryKeys.incident(incidentId), context.previousIncident);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.incident(incidentId) });
    },
  });
}
