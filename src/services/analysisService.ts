import type { AnalysisRun } from '../../shared/types/analysisRun';
import type { Incident } from '../../shared/types/incident';
import type { ReviewStatus } from '../../shared/types/reasoning';
import { apiRequest } from './apiClient';

/**
 * Triggers one AI analysis pass over an incident's evidence.
 *
 * @param incidentId The incident to analyze.
 * @returns The newly created analysis run.
 */
export async function analyzeIncident(incidentId: string): Promise<AnalysisRun> {
  return apiRequest<AnalysisRun>(`/api/incidents/${incidentId}/analyze`, { method: 'POST' });
}

/**
 * Records a human reviewer's judgment on a fact or assumption.
 *
 * @param incidentId The incident the statement belongs to.
 * @param statementId The fact or assumption's id.
 * @param reviewStatus The reviewer's judgment.
 * @returns The updated incident.
 */
export async function reviewStatement(
  incidentId: string,
  statementId: string,
  reviewStatus: ReviewStatus,
): Promise<Incident> {
  return apiRequest<Incident>(`/api/incidents/${incidentId}/statements/${statementId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ reviewStatus }),
  });
}
