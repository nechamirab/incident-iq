import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import { mapAiResponseToAnalysisRun } from '../../src/ai/mapAnalysisResponse.js';
import { buildValidAiResponse } from './aiResponseFixtures.js';

/**
 * Builds a minimal, realistic {@link AnalysisRun} by running a valid AI
 * response through the real mapping function, so nested ids/status fields
 * are generated exactly the way production code generates them (three
 * hypotheses with confidences 50/30/20, so the first is always leading).
 */
export function buildAnalysisRun(incident: Incident, evidenceId: string): AnalysisRun {
  return mapAiResponseToAnalysisRun({
    incident,
    response: buildValidAiResponse({}, evidenceId),
    providerName: 'mock',
    model: 'test-model',
    promptVersion: 'incident-analysis-v1',
    durationMs: 10,
    rawResponse: {},
  });
}
