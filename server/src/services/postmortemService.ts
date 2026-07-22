import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { Postmortem } from '../../../shared/types/postmortem.js';
import { mapAiResponseToPostmortem } from '../ai/mapPostmortemResponse.js';
import { buildPostmortemPrompt, POSTMORTEM_PROMPT_VERSION } from '../ai/prompts/postmortemV1.js';
import { REPAIR_INVALID_JSON_PROMPT_VERSION } from '../ai/prompts/repairInvalidJsonV1.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { runProviderWithRetry } from '../ai/runProviderWithRetry.js';
import { validatePostmortemResponse } from '../ai/validators/validatePostmortemResponse.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { PostmortemEditRequest } from '../schemas/postmortemEdit.schema.js';
import { ApiError } from '../utils/ApiError.js';

/** Runs are appended in order, so the last one is the latest. */
function getLatestAnalysisRun(incident: Incident): AnalysisRun | null {
  if (incident.analysisRuns.length === 0) {
    return null;
  }
  return incident.analysisRuns[incident.analysisRuns.length - 1];
}

/**
 * Generates (or regenerates) an AI postmortem draft from an incident's most
 * recent analysis run and persists it, fully replacing any existing draft
 * -- including a human's prior edits. Reuses the same validate-then-retry-
 * once pipeline as the main analysis and skeptic review.
 *
 * @param repository The incident repository to read/update through.
 * @param provider The AI provider to call (mock or a real one).
 * @param incidentId The incident to draft a postmortem for.
 * @returns The updated incident, including its new postmortem.
 */
export async function generatePostmortem(
  repository: IncidentRepository,
  provider: AIProvider,
  incidentId: string,
): Promise<Incident> {
  const incident = await repository.findById(incidentId);
  if (!incident) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
  }

  const run = getLatestAnalysisRun(incident);
  if (!run) {
    throw new ApiError(
      400,
      'NO_ANALYSIS_FOR_POSTMORTEM',
      `Incident "${incidentId}" has no analysis run yet. Run AI analysis before drafting a postmortem.`,
    );
  }

  const result = await runProviderWithRetry({
    incident,
    provider,
    context: { kind: 'postmortem', analysisRun: run },
    buildPrompt: () => buildPostmortemPrompt(incident, run),
    validate: validatePostmortemResponse,
    promptVersion: POSTMORTEM_PROMPT_VERSION,
    repairPromptVersion: REPAIR_INVALID_JSON_PROMPT_VERSION,
    invalidErrorCode: 'AI_RESPONSE_INVALID',
    invalidErrorMessage: 'The postmortem response could not be validated, even after one repair attempt.',
  });

  const postmortem = mapAiResponseToPostmortem({
    response: result.data,
    providerName: provider.name,
    model: provider.model,
    promptVersion: result.promptVersionUsed,
    configuredProvider: provider.configuredProvider,
    fallbackUsed: provider.fallbackUsed,
    fallbackReason: provider.fallbackReason,
  });

  const updated = await repository.setPostmortem(incidentId, postmortem);
  if (!updated) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
  }

  return updated;
}

/**
 * Applies a human reviewer's edits to an existing postmortem draft, merging
 * them into the current content and bumping `lastEditedAt` -- `generatedAt`
 * and every other provenance field are left untouched, since editing is not
 * regenerating.
 *
 * @param repository The incident repository to read/update through.
 * @param incidentId The incident whose postmortem should be edited.
 * @param patch The subset of content fields to update.
 * @returns The updated incident, including the edited postmortem.
 */
export async function editPostmortem(
  repository: IncidentRepository,
  incidentId: string,
  patch: PostmortemEditRequest,
): Promise<Incident> {
  const incident = await repository.findById(incidentId);
  if (!incident) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
  }

  if (!incident.postmortem) {
    throw new ApiError(
      400,
      'NO_POSTMORTEM_DRAFT',
      `Incident "${incidentId}" has no postmortem draft yet. Generate one before editing it.`,
    );
  }

  const merged: Postmortem = {
    ...incident.postmortem,
    ...patch,
    lastEditedAt: new Date().toISOString(),
  };

  const updated = await repository.setPostmortem(incidentId, merged);
  if (!updated) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
  }

  return updated;
}
