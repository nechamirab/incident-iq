import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { AiAnalysisResponse } from '../../src/ai/schemas/aiAnalysisResponse.schema.js';
import type { Incident } from '../../../shared/types/incident.js';
import { mapAiResponseToAnalysisRun } from '../../src/ai/mapAnalysisResponse.js';
import { buildValidAiResponse } from './aiResponseFixtures.js';

/**
 * Builds a minimal, realistic {@link AnalysisRun} by running a valid AI
 * response through the real mapping function, so nested ids/status fields
 * are generated exactly the way production code generates them (three
 * hypotheses with confidences 50/30/20, so the first is always leading).
 *
 * @param responseOverrides Optional overrides applied on top of {@link buildValidAiResponse}'s default (e.g. `{ reasoningRisks: [] }` for a test that specifically needs an empty section).
 */
export function buildAnalysisRun(
  incident: Incident,
  evidenceId: string,
  responseOverrides: Partial<AiAnalysisResponse> = {},
): AnalysisRun {
  return mapAiResponseToAnalysisRun({
    incident,
    response: buildValidAiResponse(responseOverrides, evidenceId),
    providerName: 'mock',
    model: 'test-model',
    promptVersion: 'incident-analysis-v1',
    durationMs: 10,
    rawResponse: {},
  });
}
