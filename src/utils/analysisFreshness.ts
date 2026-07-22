import type { Incident } from '../../shared/types/incident';
import { getLatestSuccessfulAnalysisRun } from './getLatestSuccessfulAnalysisRun';

export type AnalysisFreshness = 'not-analyzed' | 'outdated' | 'up-to-date';

/**
 * Returns the newest `createdAt` timestamp among an incident's evidence,
 * or `null` if it has none.
 */
export function getNewestEvidenceCreatedAt(incident: Incident): string | null {
  if (incident.evidence.length === 0) {
    return null;
  }
  return incident.evidence.reduce(
    (latest, item) => (item.createdAt > latest ? item.createdAt : latest),
    incident.evidence[0].createdAt,
  );
}

/**
 * Derives whether an incident's latest successful analysis is stale
 * relative to its evidence, without persisting any redundant "outdated"
 * flag of its own:
 *
 * - `"not-analyzed"` -- no successful analysis run exists yet (never
 *   reported as "outdated" -- there is nothing yet to be behind).
 * - `"outdated"` -- evidence exists that was created after the latest
 *   successful analysis run.
 * - `"up-to-date"` -- the latest successful analysis already covers every
 *   piece of evidence currently attached.
 *
 * @param incident The incident to evaluate.
 * @returns The incident's current analysis freshness.
 */
export function getAnalysisFreshness(incident: Incident): AnalysisFreshness {
  const latestRun = getLatestSuccessfulAnalysisRun(incident);
  if (!latestRun) {
    return 'not-analyzed';
  }

  const newestEvidenceAt = getNewestEvidenceCreatedAt(incident);
  if (newestEvidenceAt !== null && newestEvidenceAt > latestRun.createdAt) {
    return 'outdated';
  }

  return 'up-to-date';
}
