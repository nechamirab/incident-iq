import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { SkepticReview } from '../../../shared/types/skepticReview.js';
import { mapAiResponseToSkepticReview } from '../ai/mapSkepticReviewResponse.js';
import { buildSkepticReviewPrompt, SKEPTIC_REVIEW_PROMPT_VERSION } from '../ai/prompts/skepticReviewV1.js';
import { REPAIR_INVALID_JSON_PROMPT_VERSION } from '../ai/prompts/repairInvalidJsonV1.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { runProviderWithRetry } from '../ai/runProviderWithRetry.js';
import { validateSkepticReviewResponse } from '../ai/validators/validateSkepticReviewResponse.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import { ApiError } from '../utils/ApiError.js';

/** Runs are appended in order, so the last one is the latest. */
function getLatestAnalysisRun(incident: Incident): AnalysisRun | null {
  if (incident.analysisRuns.length === 0) {
    return null;
  }
  return incident.analysisRuns[incident.analysisRuns.length - 1];
}

/**
 * Calls the provider, validates its response, and -- if validation fails --
 * retries exactly once with a repair prompt, then maps the validated
 * response into a persisted {@link SkepticReview}.
 */
async function runSkepticReviewWithRetry(
  incident: Incident,
  run: AnalysisRun,
  provider: AIProvider,
): Promise<SkepticReview> {
  const result = await runProviderWithRetry({
    incident,
    provider,
    context: { kind: 'skeptic-review', analysisRun: run },
    buildPrompt: () => buildSkepticReviewPrompt(incident, run),
    validate: validateSkepticReviewResponse,
    promptVersion: SKEPTIC_REVIEW_PROMPT_VERSION,
    repairPromptVersion: REPAIR_INVALID_JSON_PROMPT_VERSION,
    invalidErrorCode: 'AI_RESPONSE_INVALID',
    invalidErrorMessage: 'The skeptic review response could not be validated, even after one repair attempt.',
  });

  return mapAiResponseToSkepticReview({
    incident,
    run,
    response: result.data,
    providerName: provider.name,
    model: provider.model,
    promptVersion: result.promptVersionUsed,
    durationMs: result.durationMs,
    rawResponse: { rawText: result.rawText, repaired: result.repaired },
    configuredProvider: provider.configuredProvider,
    fallbackUsed: provider.fallbackUsed,
    fallbackReason: provider.fallbackReason,
  });
}

/**
 * Runs one skeptic-review pass over an incident's most recent analysis run
 * and persists the result alongside it -- the review is a new, separate
 * record; the original analysis run is never modified.
 *
 * @param repository The incident repository to read/update through.
 * @param provider The AI provider to call (mock or a real one).
 * @param incidentId The incident whose latest analysis run should be reviewed.
 * @returns The newly created, persisted skeptic review.
 */
export async function runSkepticReview(
  repository: IncidentRepository,
  provider: AIProvider,
  incidentId: string,
): Promise<SkepticReview> {
  const incident = await repository.findById(incidentId);
  if (!incident) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
  }

  const run = getLatestAnalysisRun(incident);
  if (!run) {
    throw new ApiError(
      400,
      'NO_ANALYSIS_TO_REVIEW',
      `Incident "${incidentId}" has no analysis run yet. Run AI analysis before requesting a skeptic review.`,
    );
  }

  const review = await runSkepticReviewWithRetry(incident, run, provider);
  const updated = await repository.addSkepticReview(incidentId, review);
  if (!updated) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
  }

  return review;
}
