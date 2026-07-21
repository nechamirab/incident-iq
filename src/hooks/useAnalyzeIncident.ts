import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { AnalysisRun } from '../../shared/types/analysisRun';
import { queryKeys } from '../constants/queryKeys';
import { analyzeIncident } from '../services/analysisService';

/**
 * Triggers an AI analysis run for an incident and refreshes the cached
 * incident (and incident list) afterward so the new run's data appears.
 */
export function useAnalyzeIncident(incidentId: string): UseMutationResult<AnalysisRun, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => analyzeIncident(incidentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.incident(incidentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
    },
  });
}
