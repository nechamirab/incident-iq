import type { AnalysisRun } from '../../shared/types/analysisRun';

/** Builds a minimal, valid AnalysisRun fixture for tests, with overrides. */
export function buildAnalysisRun(overrides: Partial<AnalysisRun> = {}): AnalysisRun {
  return {
    id: 'run-1',
    incidentId: 'incident-1',
    provider: 'mock',
    model: 'mock-deterministic-v1',
    promptVersion: 'incident-analysis-v1',
    createdAt: '2026-07-01T00:00:00Z',
    inputHash: 'hash-1',
    durationMs: 10,
    status: 'completed',
    summary: { text: 'Summary', affectedComponents: [], impact: 'Unknown' },
    timeline: [],
    facts: [],
    assumptions: [],
    hypotheses: [],
    reasoningRisks: [],
    recommendedActions: [],
    openQuestions: [],
    unsupportedClaims: [],
    uncertaintyStatement: 'This is a test fixture.',
    validationWarnings: [],
    rawResponse: null,
    ...overrides,
  };
}
