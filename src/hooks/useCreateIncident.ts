import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Incident } from '../../shared/types/incident';
import { queryKeys } from '../constants/queryKeys';
import { createIncident } from '../services/incidentService';
import type { NewIncidentFormValues } from '../schemas/newIncidentForm.schema';

interface CreateIncidentVariables {
  values: NewIncidentFormValues;
  files: File[];
}

/**
 * Creates a new incident and invalidates the incident list cache on
 * success so the Dashboard and "load sample incident" list stay in sync.
 */
export function useCreateIncident(): UseMutationResult<
  Incident,
  Error,
  CreateIncidentVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, files }: CreateIncidentVariables) => createIncident(values, files),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
    },
  });
}
