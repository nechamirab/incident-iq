import type { AnalysisRun } from '../../shared/types/analysisRun';
import type { Incident } from '../../shared/types/incident';

/**
 * Returns the most recent *successfully completed* analysis run (`status
 * === "completed"`), skipping any trailing failed/pending run -- distinct
 * from `getLatestAnalysisRun`, which returns the last run regardless of
 * status. Used wherever "has this incident actually been analyzed"
 * matters more than "was analysis attempted".
 */
export function getLatestSuccessfulAnalysisRun(incident: Incident): AnalysisRun | null {
  for (let index = incident.analysisRuns.length - 1; index >= 0; index -= 1) {
    if (incident.analysisRuns[index].status === 'completed') {
      return incident.analysisRuns[index];
    }
  }
  return null;
}
