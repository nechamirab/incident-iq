import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import { mapAiResponseToAnalysisRun } from '../ai/mapAnalysisResponse.js';
import { mergeCompletionRepair } from '../ai/mergeCompletionRepair.js';
import { buildIncidentAnalysisPromptV2, INCIDENT_ANALYSIS_V2_PROMPT_VERSION } from '../ai/prompts/incidentAnalysisV2.js';
import { REPAIR_INVALID_JSON_PROMPT_VERSION } from '../ai/prompts/repairInvalidJsonV1.js';
import { buildTargetedCompletionRepairPrompt } from '../ai/prompts/targetedCompletionRepairV1.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { runProviderWithRetry } from '../ai/runProviderWithRetry.js';
import { identifyRepairableDeficiencies } from '../ai/validators/analysisQualityEvaluator.js';
import { validateAIResponse } from '../ai/validators/validateAIResponse.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Calls the provider, validates its response, and -- if validation fails --
 * retries exactly once with a repair prompt (see {@link runProviderWithRetry}
 * for the shared retry contract). If the (now schema-valid) response is
 * found incomplete by the quality gate (e.g. no reasoning risks, every
 * hypothesis missing contradicting evidence), attempts exactly one further
 * targeted completion-repair request limited to the deficient sections --
 * `facts` and `summary` are never altered by this pass. Whether it was
 * repaired successfully, attempted without improvement, or never needed,
 * the (possibly merged) response is then mapped into a persisted
 * {@link AnalysisRun}.
 */
async function runAnalysisWithRetry(incident: Incident, provider: AIProvider): Promise<AnalysisRun> {
  const startedAt = Date.now();

  const result = await runProviderWithRetry({
    incident,
    provider,
    buildPrompt: () => buildIncidentAnalysisPromptV2(incident),
    validate: validateAIResponse,
    promptVersion: INCIDENT_ANALYSIS_V2_PROMPT_VERSION,
    repairPromptVersion: REPAIR_INVALID_JSON_PROMPT_VERSION,
    invalidErrorCode: 'AI_RESPONSE_INVALID',
    invalidErrorMessage: 'The AI response could not be validated, even after one repair attempt.',
  });

  const deficiencies = identifyRepairableDeficiencies(result.data, incident.evidence.length);

  let finalResponse = result.data;
  let completionRepairAttempted = false;
  let completionRepairedSections: string[] = [];
  let totalDurationMs = result.durationMs;

  if (deficiencies.length > 0) {
    completionRepairAttempted = true;
    try {
      const knownEvidenceIds = incident.evidence.map((item) => item.id);
      const originalPrompt = buildIncidentAnalysisPromptV2(incident);
      const repairPrompt = buildTargetedCompletionRepairPrompt(
        originalPrompt,
        result.rawText,
        deficiencies,
        knownEvidenceIds,
      );

      const repairedRawText = await provider.complete(incident, repairPrompt);
      const repairedValidation = validateAIResponse(repairedRawText);

      if (repairedValidation.success) {
        const merged = mergeCompletionRepair(result.data, repairedValidation.data, deficiencies);
        finalResponse = merged.response;
        completionRepairedSections = merged.repairedSections;
      }
      // An invalid repaired response is silently discarded -- the original,
      // already-valid result is kept, exactly as the "no endless retry loop"
      // / "keep the original valid result" requirement specifies.
    } catch {
      // The repair call itself failed (network/provider error) -- keep the
      // original valid result rather than letting a best-effort quality
      // improvement turn a successful analysis into a failed one.
    }
    totalDurationMs = Date.now() - startedAt;
  }

  return mapAiResponseToAnalysisRun({
    incident,
    response: finalResponse,
    providerName: provider.name,
    model: provider.model,
    promptVersion: result.promptVersionUsed,
    durationMs: totalDurationMs,
    rawResponse: { rawText: result.rawText, repaired: result.repaired },
    configuredProvider: provider.configuredProvider,
    fallbackUsed: provider.fallbackUsed,
    fallbackReason: provider.fallbackReason,
    providerRequestId: provider.providerRequestId,
    completionRepairAttempted,
    completionRepairedSections,
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
