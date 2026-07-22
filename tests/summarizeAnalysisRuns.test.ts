import { describe, expect, it } from 'vitest';
import { summarizeAnalysisRuns } from '../src/utils/summarizeAnalysisRuns';
import type { AnalysisRun } from '../shared/types/analysisRun';
import type { Hypothesis } from '../shared/types/hypothesis';

function buildHypothesis(overrides: Partial<Hypothesis> = {}): Hypothesis {
  return {
    id: 'hyp-1',
    title: 'A hypothesis',
    description: 'x',
    confidence: 50,
    confidenceReason: 'x',
    supportingEvidenceIds: [],
    contradictingEvidenceIds: [],
    assumptions: [],
    recommendedTest: 'x',
    expectedResult: 'x',
    status: 'proposed',
    ...overrides,
  };
}

function buildRun(overrides: Partial<AnalysisRun> = {}): AnalysisRun {
  return {
    id: 'run-1',
    incidentId: 'incident-1',
    provider: 'mock',
    model: 'mock-v1',
    promptVersion: 'incident-analysis-v1',
    createdAt: '2026-07-01T00:00:00Z',
    inputHash: 'hash',
    durationMs: 100,
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
    uncertaintyStatement: 'Test fixture.',
    validationWarnings: [],
    rawResponse: null,
    ...overrides,
  };
}

describe('summarizeAnalysisRuns', () => {
  it('returns one row per run, preserving order', () => {
    const runs = [buildRun({ id: 'run-1' }), buildRun({ id: 'run-2' })];
    const rows = summarizeAnalysisRuns(runs);
    expect(rows.map((row) => row.id)).toEqual(['run-1', 'run-2']);
  });

  it('carries provider, model, promptVersion, and createdAt through unchanged', () => {
    const run = buildRun({ provider: 'anthropic', model: 'claude-x', promptVersion: 'incident-analysis-v1' });
    const [row] = summarizeAnalysisRuns([run]);
    expect(row.provider).toBe('anthropic');
    expect(row.model).toBe('claude-x');
    expect(row.promptVersion).toBe('incident-analysis-v1');
    expect(row.createdAt).toBe(run.createdAt);
  });

  it('counts hypotheses and finds the highest confidence', () => {
    const run = buildRun({
      hypotheses: [
        buildHypothesis({ id: 'h1', confidence: 30 }),
        buildHypothesis({ id: 'h2', confidence: 70 }),
        buildHypothesis({ id: 'h3', confidence: 50 }),
      ],
    });
    const [row] = summarizeAnalysisRuns([run]);
    expect(row.hypothesisCount).toBe(3);
    expect(row.topConfidence).toBe(70);
  });

  it('reports a null topConfidence when a run has no hypotheses', () => {
    const [row] = summarizeAnalysisRuns([buildRun({ hypotheses: [] })]);
    expect(row.hypothesisCount).toBe(0);
    expect(row.topConfidence).toBeNull();
  });

  it('returns an empty array for no runs', () => {
    expect(summarizeAnalysisRuns([])).toEqual([]);
  });
});
