import type { Incident } from '../../shared/types/incident';
import type { UpdateHypothesisStatusPayload } from '../services/analysisService';

/**
 * Computes what an incident should look like immediately after a
 * hypothesis-status update, before the server has actually responded --
 * used to drive the optimistic cache update in
 * {@link useUpdateHypothesisStatus}. Mirrors the backend's
 * `InMemoryIncidentRepository.updateHypothesisStatus` exactly: records
 * `previousStatus` from whatever the hypothesis's status currently is,
 * stamps `reviewedAt` with the current time, and sets `humanReviewNote`
 * from the payload (`null` if omitted).
 *
 * Pure and independent of TanStack Query so it can be unit-tested directly.
 *
 * @param incident The incident currently in cache.
 * @param hypothesisId The hypothesis being updated (searched across every analysis run, since it always belongs to exactly one).
 * @param payload The status-update request about to be sent.
 * @returns The optimistically-updated incident (a new object; `incident` itself is never mutated).
 */
export function applyOptimisticHypothesisStatusUpdate(
  incident: Incident,
  hypothesisId: string,
  payload: UpdateHypothesisStatusPayload,
): Incident {
  const reviewedAt = new Date().toISOString();

  return {
    ...incident,
    analysisRuns: incident.analysisRuns.map((run) => ({
      ...run,
      hypotheses: run.hypotheses.map((hypothesis) => {
        if (hypothesis.id !== hypothesisId) {
          return hypothesis;
        }
        return {
          ...hypothesis,
          previousStatus: hypothesis.status,
          status: payload.status,
          reviewedAt,
          humanReviewNote: payload.humanReviewNote ?? null,
        };
      }),
    })),
    updatedAt: reviewedAt,
  };
}
