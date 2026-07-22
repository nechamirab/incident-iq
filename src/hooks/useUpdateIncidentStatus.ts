import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import {
  updateIncidentStatus,
  type UpdateIncidentStatusPayload,
} from '../services/incidentService';
import { applyOptimisticStatusUpdate } from '../utils/applyOptimisticStatusUpdate';

interface UpdateIncidentStatusContext {
  previousIncident: Incident | undefined;
}

/**
 * Updates an incident's lifecycle status with an optimistic cache update:
 * the cached incident is updated immediately (so the selector reflects the
 * new status without waiting on the network), rolled back automatically if
 * the request fails, and every incident-related query is invalidated once
 * the request settles so the Dashboard's list, counts, and filters (all
 * derived from the same `incidents` query) and this incident's own detail
 * view stay in sync -- without duplicating any of that server state in
 * Zustand.
 */
export function useUpdateIncidentStatus(
  incidentId: string,
): UseMutationResult<Incident, Error, UpdateIncidentStatusPayload, UpdateIncidentStatusContext> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateIncidentStatusPayload) => updateIncidentStatus(incidentId, payload),

    onMutate: async (payload: UpdateIncidentStatusPayload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.incident(incidentId) });

      const previousIncident = queryClient.getQueryData<Incident>(queryKeys.incident(incidentId));

      if (previousIncident) {
        queryClient.setQueryData<Incident>(
          queryKeys.incident(incidentId),
          applyOptimisticStatusUpdate(previousIncident, payload),
        );
      }

      return { previousIncident };
    },

    onError: (_error, _payload, context) => {
      if (context?.previousIncident) {
        queryClient.setQueryData(queryKeys.incident(incidentId), context.previousIncident);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.incident(incidentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sampleIncidents });
    },
  });
}
