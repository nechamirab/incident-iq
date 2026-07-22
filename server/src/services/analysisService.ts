import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import { mapAiResponseToAnalysisRun } from '../ai/mapAnalysisResponse.js';
import {
  buildIncidentAnalysisPrompt,
  INCIDENT_ANALYSIS_PROMPT_VERSION,
} from '../ai/prompts/incidentAnalysisV1.js';
import { REPAIR_INVALID_JSON_PROMPT_VERSION } from '../ai/prompts/repairInvalidJsonV1.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { runProviderWithRetry } from '../ai/runProviderWithRetry.js';
import { validateAIResponse } from '../ai/validators/validateAIResponse.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Calls the provider, validates its response, and -- if validation fails --
 * retries exactly once with a repair prompt (see {@link runProviderWithRetry}
 * for the shared retry contract), then maps the validated response into a
 * persisted {@link AnalysisRun}.
 */
async function runAnalysisWithRetry(incident: Incident, provider: AIProvider): Promise<AnalysisRun> {
  const result = await runProviderWithRetry({
    incident,
    provider,
    buildPrompt: () => buildIncidentAnalysisPrompt(incident),
    validate: validateAIResponse,
    promptVersion: INCIDENT_ANALYSIS_PROMPT_VERSION,
    repairPromptVersion: REPAIR_INVALID_JSON_PROMPT_VERSION,
    invalidErrorCode: 'AI_RESPONSE_INVALID',
    invalidErrorMessage: 'The AI response could not be validated, even after one repair attempt.',
  });

  return mapAiResponseToAnalysisRun({
    incident,
    response: result.data,
    providerName: provider.name,
    model: provider.model,
    promptVersion: result.promptVersionUsed,
    durationMs: result.durationMs,
    rawResponse: { rawText: result.rawText, repaired: result.repaired },
    configuredProvider: provider.configuredProvider,
    fallbackUsed: provider.fallbackUsed,
    fallbackReason: provider.fallbackReason,
    providerRequestId: provider.providerRequestId,
  });
}

/**
 * Runs one AI analysis pass over an incident and persists the result.
 * Marks the incident `analyzing` while the request is in flight, then
 * either `under-investigation` on success or reverts to its prior status
 * on failure -- so a failed analysis never leaves an incident stuck in a
 * transient state.
 *
 * @param repository The incident repository to read/update through.
 * @param provider The AI provider to call (mock or a real one).
 * @param incidentId The incident to analyze.
 * @returns The newly created, persisted analysis run.
 */
export async function analyzeIncident(
  repository: IncidentRepository,
  provider: AIProvider,
  incidentId: string,
): Promise<AnalysisRun> {
  const incident = await repository.findById(incidentId);
  if (!incident) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
  }

  const priorStatus = incident.status;
  await repository.update(incidentId, { status: 'analyzing' });

  try {
    const run = await runAnalysisWithRetry(incident, provider);
    await repository.addAnalysisRun(incidentId, run);
    await repository.update(incidentId, {
      status: priorStatus === 'resolved' || priorStatus === 'archived' ? priorStatus : 'under-investigation',
    });
    return run;
  } catch (error) {
    await repository.update(incidentId, { status: priorStatus });
    throw error;
  }
}
