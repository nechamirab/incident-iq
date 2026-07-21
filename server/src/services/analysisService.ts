import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import { mapAiResponseToAnalysisRun } from '../ai/mapAnalysisResponse.js';
import {
  buildIncidentAnalysisPrompt,
  INCIDENT_ANALYSIS_PROMPT_VERSION,
} from '../ai/prompts/incidentAnalysisV1.js';
import { buildRepairPrompt, REPAIR_INVALID_JSON_PROMPT_VERSION } from '../ai/prompts/repairInvalidJsonV1.js';
import type { AIPrompt, AIProvider } from '../ai/providers/AIProvider.js';
import { validateAIResponse, type AIResponseValidation } from '../ai/validators/validateAIResponse.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import { ApiError } from '../utils/ApiError.js';

interface ProviderAttempt {
  rawText: string;
  validation: AIResponseValidation;
}

async function callAndValidate(
  incident: Incident,
  provider: AIProvider,
  prompt: AIPrompt,
): Promise<ProviderAttempt> {
  const rawText = await provider.complete(incident, prompt);
  return { rawText, validation: validateAIResponse(rawText) };
}

/**
 * Calls the provider, validates its response, and -- if validation fails
 * (invalid JSON, or JSON that doesn't match the required schema) -- retries
 * exactly once with a repair prompt describing what was wrong. Throws a
 * controlled {@link ApiError} if the response is still invalid after the
 * retry; a malformed response is never returned to the caller.
 */
async function runAnalysisWithRetry(incident: Incident, provider: AIProvider): Promise<AnalysisRun> {
  const startedAt = Date.now();
  const prompt = buildIncidentAnalysisPrompt(incident);

  const firstAttempt = await callAndValidate(incident, provider, prompt);
  if (firstAttempt.validation.success) {
    return mapAiResponseToAnalysisRun({
      incident,
      response: firstAttempt.validation.data,
      providerName: provider.name,
      model: provider.model,
      promptVersion: INCIDENT_ANALYSIS_PROMPT_VERSION,
      durationMs: Date.now() - startedAt,
      rawResponse: { rawText: firstAttempt.rawText, repaired: false },
    });
  }

  const repairPrompt = buildRepairPrompt(prompt, firstAttempt.rawText, firstAttempt.validation.issues);
  const secondAttempt = await callAndValidate(incident, provider, repairPrompt);
  if (secondAttempt.validation.success) {
    return mapAiResponseToAnalysisRun({
      incident,
      response: secondAttempt.validation.data,
      providerName: provider.name,
      model: provider.model,
      promptVersion: REPAIR_INVALID_JSON_PROMPT_VERSION,
      durationMs: Date.now() - startedAt,
      rawResponse: { rawText: secondAttempt.rawText, repaired: true },
    });
  }

  throw new ApiError(
    502,
    'AI_RESPONSE_INVALID',
    'The AI response could not be validated, even after one repair attempt.',
    {
      firstAttemptIssues: firstAttempt.validation.issues,
      secondAttemptIssues: secondAttempt.validation.issues,
    },
  );
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
