import type { AiProviderName, AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { SkepticReview } from '../../../shared/types/skepticReview.js';
import { findLeadingHypothesis } from './prompts/skepticReviewV1.js';
import type { AiSkepticReviewResponse } from './schemas/skepticReviewResponse.schema.js';
import { createId } from '../utils/id.js';

export interface MapSkepticReviewResponseParams {
  incident: Incident;
  run: AnalysisRun;
  response: AiSkepticReviewResponse;
  providerName: AiProviderName;
  model: string;
  promptVersion: string;
  durationMs: number;
  rawResponse: unknown;
  /** What `AI_PROVIDER` was actually configured to; defaults to `providerName` (i.e. "not a fallback") when omitted. */
  configuredProvider?: AiProviderName;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
}

/**
 * Collects every evidence id cited anywhere in an analysis run (facts,
 * assumptions, timeline, hypotheses, reasoning risks, recommended actions).
 */
function collectCitedEvidenceIds(run: AnalysisRun): Set<string> {
  const ids = new Set<string>();
  const add = (list: readonly string[]): void => {
    for (const id of list) {
      ids.add(id);
    }
  };

  for (const item of run.facts) add(item.evidenceIds);
  for (const item of run.assumptions) add(item.evidenceIds);
  for (const item of run.timeline) add(item.evidenceIds);
  for (const item of run.hypotheses) {
    add(item.supportingEvidenceIds);
    add(item.contradictingEvidenceIds);
  }
  for (const item of run.reasoningRisks) add(item.evidenceIds);
  for (const item of run.recommendedActions) add(item.evidenceIds);

  return ids;
}

/**
 * Converts a schema-validated {@link AiSkepticReviewResponse} into a
 * persisted {@link SkepticReview}. `challengedHypothesisId` and
 * `ignoredEvidenceIds` are always computed here from the run being
 * reviewed, never taken from the AI's response -- see the doc comment on
 * `AiSkepticReviewResponseSchema` for why.
 */
export function mapAiResponseToSkepticReview(params: MapSkepticReviewResponseParams): SkepticReview {
  const {
    incident,
    run,
    response,
    providerName,
    model,
    promptVersion,
    durationMs,
    rawResponse,
    configuredProvider = providerName,
    fallbackUsed = false,
    fallbackReason = null,
  } = params;

  const leading = findLeadingHypothesis(run);
  const citedEvidenceIds = collectCitedEvidenceIds(run);
  const ignoredEvidenceIds = incident.evidence
    .map((item) => item.id)
    .filter((id) => !citedEvidenceIds.has(id));

  return {
    id: createId('skeptic-review'),
    incidentId: incident.id,
    analysisRunId: run.id,
    provider: providerName,
    model,
    promptVersion,
    createdAt: new Date().toISOString(),
    durationMs,
    configuredProvider,
    fallbackUsed,
    fallbackReason,
    challengedHypothesisId: leading.id,
    challengeSummary: response.challengeSummary,
    alternativeExplanations: response.alternativeExplanations,
    ignoredEvidenceIds,
    confirmationBiasAssessment: response.confirmationBiasAssessment,
    falsificationTest: response.falsificationTest,
    recommendedTests: response.recommendedTests,
    overallAssessment: response.overallAssessment,
    humanNotes: null,
    rawResponse,
  };
}
