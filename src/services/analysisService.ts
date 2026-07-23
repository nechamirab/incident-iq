import type { AnalysisRun } from '../../shared/types/analysisRun';
import type { HypothesisStatus } from '../../shared/types/hypothesis';
import type { Incident } from '../../shared/types/incident';
import type { ReviewStatus } from '../../shared/types/reasoning';
import type { SkepticReview } from '../../shared/types/skepticReview';
import { apiRequest } from './apiClient';

/** Request payload for {@link updateHypothesisStatus}. */
export interface UpdateHypothesisStatusPayload {
  status: HypothesisStatus;
  /** Optional free-text note explaining the reviewer's judgment. */
  humanReviewNote?: string;
  /** Required (and must be `true`) when `status` is `"confirmed-by-human"` -- the backend rejects the request otherwise. */
  confirmed?: boolean;
}

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

/**
 * Records a human reviewer's judgment on a hypothesis -- the only path
 * that can ever move a hypothesis to `confirmed-by-human`; the AI itself
 * can never set that status, and the backend rejects this call unless
 * `confirmed: true` is explicitly included alongside it.
 *
 * @param incidentId The incident the hypothesis belongs to.
 * @param hypothesisId The hypothesis's id.
 * @param payload The new status, and an optional review note.
 * @returns The updated incident.
 */
export async function updateHypothesisStatus(
  incidentId: string,
  hypothesisId: string,
  payload: UpdateHypothesisStatusPayload,
): Promise<Incident> {
  return apiRequest<Incident>(`/api/incidents/${incidentId}/hypotheses/${hypothesisId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Runs one skeptic review of an incident's most recent analysis run: a
 * critical second pass that challenges the leading hypothesis without
 * modifying the original analysis.
 *
 * @param incidentId The incident to review.
 * @returns The newly created skeptic review.
 */
export async function runSkepticReview(incidentId: string): Promise<SkepticReview> {
  return apiRequest<SkepticReview>(`/api/incidents/${incidentId}/skeptic-review`, { method: 'POST' });
}

/**
 * Records a human reviewer's own notes on a skeptic review.
 *
 * @param incidentId The incident the skeptic review belongs to.
 * @param reviewId The skeptic review's id.
 * @param humanNotes The reviewer's notes (may be an empty string to clear them).
 * @returns The updated incident.
 */
export async function updateSkepticReviewNotes(
  incidentId: string,
  reviewId: string,
  humanNotes: string,
): Promise<Incident> {
  return apiRequest<Incident>(`/api/incidents/${incidentId}/skeptic-reviews/${reviewId}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({ humanNotes }),
  });
}
