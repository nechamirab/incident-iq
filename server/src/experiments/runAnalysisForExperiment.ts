import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import { mapAiResponseToAnalysisRun } from '../ai/mapAnalysisResponse.js';
import { REPAIR_INVALID_JSON_PROMPT_VERSION } from '../ai/prompts/repairInvalidJsonV1.js';
import type { AIPrompt, AIProvider } from '../ai/providers/AIProvider.js';
import { runProviderWithRetry } from '../ai/runProviderWithRetry.js';
import { evaluateAnalysisQuality, type AnalysisQualityReport } from '../ai/validators/analysisQualityEvaluator.js';
import { validateAIResponse } from '../ai/validators/validateAIResponse.js';
import type { ExperimentCallMetadata } from './types.js';

export interface AnalysisExperimentResult {
  incidentId: string;
  metadata: ExperimentCallMetadata;
  run: AnalysisRun;
  quality: AnalysisQualityReport;
}

/**
 * Runs one incident analysis for the critical-AI-experiment framework,
 * given an arbitrary prompt builder and provider. Deliberately reuses the
 * exact same shared pipeline production code depends on
 * (`runProviderWithRetry`, `validateAIResponse`, `mapAiResponseToAnalysisRun`,
 * `evaluateAnalysisQuality`) -- an experiment must observe the same
 * validation behavior a real user would see, never a separate, weaker path.
 *
 * Unlike `analysisService.analyzeIncident`, this deliberately does **not**
 * run the Stage 2.3 targeted completion-repair pass: experiments exist to
 * compare *raw* prompt/provider output quality (e.g. "does v2 produce fewer
 * empty-reasoning-risks responses than v1"), and the repair pass would mask
 * exactly the difference being measured. It also never persists anything --
 * experiments are read-only against the bundled sample incidents.
 *
 * @param incident The (bundled, synthetic) incident to analyze.
 * @param provider The provider to call (mock or a real one).
 * @param buildPrompt The prompt builder under test (e.g. v1, v2, or an experimental variant).
 * @param promptVersion The version identifier to record for this call.
 */
export async function runAnalysisForExperiment(
  incident: Incident,
  provider: AIProvider,
  buildPrompt: (incident: Incident) => AIPrompt,
  promptVersion: string,
): Promise<AnalysisExperimentResult> {
  const result = await runProviderWithRetry({
    incident,
    provider,
    buildPrompt: () => buildPrompt(incident),
    validate: validateAIResponse,
    promptVersion,
    repairPromptVersion: REPAIR_INVALID_JSON_PROMPT_VERSION,
    invalidErrorCode: 'AI_EXPERIMENT_RESPONSE_INVALID',
    invalidErrorMessage:
      'The AI response could not be validated during a critical-AI experiment, even after one repair attempt.',
  });

  const run = mapAiResponseToAnalysisRun({
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

  return {
    incidentId: incident.id,
    run,
    quality: evaluateAnalysisQuality(result.data, incident.evidence.length),
    metadata: {
      providerUsed: provider.name,
      configuredProvider: provider.configuredProvider,
      fallbackUsed: provider.fallbackUsed,
      model: provider.model,
      promptVersion: result.promptVersionUsed,
      durationMs: result.durationMs,
      redactionApplied: provider.redactionApplied,
      redactedValueCount: provider.redactedValueCount,
      redactionCategories: provider.redactionCategories,
      providerVerified: provider.providerVerified,
    },
  };
}
