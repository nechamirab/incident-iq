import type { AnalysisRun } from '../../shared/types/analysisRun';
import type { Incident } from '../../shared/types/incident';

/**
 * Returns the most recent analysis run for an incident (runs are appended
 * in order, so the last one is the latest), or `null` if none exist yet.
 */
export function getLatestAnalysisRun(incident: Incident): AnalysisRun | null {
  if (incident.analysisRuns.length === 0) {
    return null;
  }
  return incident.analysisRuns[incident.analysisRuns.length - 1];
}
