import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import { buildIncidentAnalysisPromptV2, INCIDENT_ANALYSIS_V2_PROMPT_VERSION } from '../ai/prompts/incidentAnalysisV2.js';
import { REPAIR_INVALID_JSON_PROMPT_VERSION } from '../ai/prompts/repairInvalidJsonV1.js';
import { buildSkepticReviewPrompt, SKEPTIC_REVIEW_PROMPT_VERSION } from '../ai/prompts/skepticReviewV1.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { runProviderWithRetry } from '../ai/runProviderWithRetry.js';
import { validateAIResponse } from '../ai/validators/validateAIResponse.js';
import { validateSkepticReviewResponse } from '../ai/validators/validateSkepticReviewResponse.js';
import { mapAiResponseToAnalysisRun } from '../ai/mapAnalysisResponse.js';
import type { RealCallGateResult } from './realCallGate.js';
import { evaluateSkepticReviewCriteria, type SkepticReviewCriterionResult } from './skepticReviewCriteria.js';
import type { ExperimentLeg } from './types.js';

export interface SkepticReviewEvaluationResult {
  incidentId: string;
  /** The baseline analysis run being reviewed -- always produced with the mock provider, since Experiment D measures the *skeptic review's* quality, not the underlying analysis's. */
  baselineRun: AnalysisRun;
  reviewLeg: ExperimentLeg<{ criteria: SkepticReviewCriterionResult[] }>;
}

/**
 * Experiment D: skeptic-review evaluation. Produces a baseline analysis run
 * with the mock provider (free, deterministic -- this experiment is about
 * the skeptic review's quality, not the underlying analysis's), then runs
 * a skeptic review of that run with the supplied `reviewProvider` (mock by
 * default, or a real provider if its {@link RealCallGateResult} allows it),
 * and scores the review against {@link evaluateSkepticReviewCriteria}'s six
 * fixed criteria.
 *
 * Safe to run in mock-only mode (unlike Experiments A/C): `MockAIProvider`'s
 * skeptic review is a genuine, non-trivial function of the run being
 * reviewed, so evaluating it against these criteria is meaningful even
 * without a real provider call.
 */
export async function runSkepticReviewEvaluationExperiment(params: {
  incident: Incident;
  mockProvider: AIProvider;
  reviewProvider: AIProvider;
  reviewGate: RealCallGateResult;
}): Promise<SkepticReviewEvaluationResult> {
  const { incident, mockProvider, reviewProvider, reviewGate } = params;

  const baselineAnalysis = await runProviderWithRetry({
    incident,
    provider: mockProvider,
    buildPrompt: () => buildIncidentAnalysisPromptV2(incident),
    validate: validateAIResponse,
    promptVersion: INCIDENT_ANALYSIS_V2_PROMPT_VERSION,
    repairPromptVersion: REPAIR_INVALID_JSON_PROMPT_VERSION,
    invalidErrorCode: 'AI_EXPERIMENT_RESPONSE_INVALID',
    invalidErrorMessage: 'The baseline mock analysis response could not be validated during Experiment D.',
  });

  const baselineRun = mapAiResponseToAnalysisRun({
    incident,
    response: baselineAnalysis.data,
    providerName: mockProvider.name,
    model: mockProvider.model,
    promptVersion: baselineAnalysis.promptVersionUsed,
    durationMs: baselineAnalysis.durationMs,
    rawResponse: { rawText: baselineAnalysis.rawText, repaired: baselineAnalysis.repaired },
  });

  if (reviewProvider.name !== 'mock' && !reviewGate.allowed) {
    return {
      incidentId: incident.id,
      baselineRun,
      reviewLeg: { status: 'not-run', provider: reviewProvider.name, reason: reviewGate.reason },
    };
  }

  const reviewResult = await runProviderWithRetry({
    incident,
    provider: reviewProvider,
    context: { kind: 'skeptic-review', analysisRun: baselineRun },
    buildPrompt: () => buildSkepticReviewPrompt(incident, baselineRun),
    validate: validateSkepticReviewResponse,
    promptVersion: SKEPTIC_REVIEW_PROMPT_VERSION,
    repairPromptVersion: REPAIR_INVALID_JSON_PROMPT_VERSION,
    invalidErrorCode: 'AI_EXPERIMENT_RESPONSE_INVALID',
    invalidErrorMessage: 'The skeptic review response could not be validated during Experiment D.',
  });

  const criteria = evaluateSkepticReviewCriteria(reviewResult.data, baselineRun);

  return {
    incidentId: incident.id,
    baselineRun,
    reviewLeg: {
      status: 'ran',
      provider: reviewProvider.name,
      metadata: {
        providerUsed: reviewProvider.name,
        configuredProvider: reviewProvider.configuredProvider,
        fallbackUsed: reviewProvider.fallbackUsed,
        model: reviewProvider.model,
        promptVersion: reviewResult.promptVersionUsed,
        durationMs: reviewResult.durationMs,
        redactionApplied: reviewProvider.redactionApplied,
        redactedValueCount: reviewProvider.redactedValueCount,
        redactionCategories: reviewProvider.redactionCategories,
        providerVerified: reviewProvider.providerVerified,
      },
      result: { criteria },
    },
  };
}
