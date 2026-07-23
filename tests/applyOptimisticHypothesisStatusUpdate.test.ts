import { describe, expect, it } from 'vitest';
import { applyOptimisticHypothesisStatusUpdate } from '../src/utils/applyOptimisticHypothesisStatusUpdate';
import { buildIncident } from './helpers/incidentFixture';
import type { AnalysisRun } from '../shared/types/analysisRun';
import type { Hypothesis } from '../shared/types/hypothesis';

function buildHypothesis(overrides: Partial<Hypothesis> = {}): Hypothesis {
  return {
    id: 'hyp-1',
    title: 'Test hypothesis',
    description: 'A candidate explanation.',
    confidence: 50,
    confidenceReason: 'Some evidence supports it.',
    supportingEvidenceIds: [],
    contradictingEvidenceIds: [],
    assumptions: [],
    recommendedTest: 'Do a test.',
    expectedResult: 'An expected result.',
    status: 'proposed',
    ...overrides,
  };
}

function buildRun(hypotheses: Hypothesis[]): AnalysisRun {
  return {
    id: 'run-1',
    incidentId: 'incident-1',
    provider: 'mock',
    model: 'mock-v1',
    promptVersion: 'incident-analysis-v2',
    createdAt: '2026-07-01T00:00:00Z',
    inputHash: 'hash',
    durationMs: 10,
    status: 'completed',
    summary: { text: 'Summary', affectedComponents: [], impact: 'Unknown' },
    timeline: [],
    facts: [],
    assumptions: [],
    hypotheses,
    reasoningRisks: [],
    recommendedActions: [],
    openQuestions: [],
    unsupportedClaims: [],
    uncertaintyStatement: 'Uncertain.',
    validationWarnings: [],
    rawResponse: null,
  };
}

describe('applyOptimisticHypothesisStatusUpdate', () => {
  it('updates the targeted hypothesis\'s status, previousStatus, reviewedAt, and note', () => {
    const hypothesis = buildHypothesis({ status: 'proposed' });
    const incident = buildIncident({ analysisRuns: [buildRun([hypothesis])] });

    const updated = applyOptimisticHypothesisStatusUpdate(incident, 'hyp-1', {
      status: 'testing',
      humanReviewNote: 'Checking now.',
    });

    const updatedHypothesis = updated.analysisRuns[0]?.hypotheses[0];
    expect(updatedHypothesis?.status).toBe('testing');
    expect(updatedHypothesis?.previousStatus).toBe('proposed');
    expect(updatedHypothesis?.humanReviewNote).toBe('Checking now.');
    expect(updatedHypothesis?.reviewedAt).toBeTruthy();
  });

  it('defaults humanReviewNote to null when omitted from the payload', () => {
    const hypothesis = buildHypothesis({ status: 'proposed' });
    const incident = buildIncident({ analysisRuns: [buildRun([hypothesis])] });

    const updated = applyOptimisticHypothesisStatusUpdate(incident, 'hyp-1', { status: 'rejected' });
    expect(updated.analysisRuns[0]?.hypotheses[0]?.humanReviewNote).toBeNull();
  });

  it('does not affect an unrelated hypothesis', () => {
    const target = buildHypothesis({ id: 'hyp-1', status: 'proposed' });
    const other = buildHypothesis({ id: 'hyp-2', status: 'proposed' });
    const incident = buildIncident({ analysisRuns: [buildRun([target, other])] });

    const updated = applyOptimisticHypothesisStatusUpdate(incident, 'hyp-1', { status: 'weakened' });
    const untouched = updated.analysisRuns[0]?.hypotheses.find((h) => h.id === 'hyp-2');
    expect(untouched?.status).toBe('proposed');
    expect(untouched?.reviewedAt).toBeUndefined();
  });

  it('does not mutate the original incident object', () => {
    const hypothesis = buildHypothesis({ status: 'proposed' });
    const incident = buildIncident({ analysisRuns: [buildRun([hypothesis])] });

    applyOptimisticHypothesisStatusUpdate(incident, 'hyp-1', { status: 'supported' });

    expect(incident.analysisRuns[0]?.hypotheses[0]?.status).toBe('proposed');
  });

  it('bumps the incident\'s updatedAt', () => {
    const hypothesis = buildHypothesis({ status: 'proposed' });
    const incident = buildIncident({
      analysisRuns: [buildRun([hypothesis])],
      updatedAt: '2026-01-01T00:00:00Z',
    });

    const updated = applyOptimisticHypothesisStatusUpdate(incident, 'hyp-1', { status: 'supported' });
    expect(updated.updatedAt).not.toBe('2026-01-01T00:00:00Z');
  });

  it('correctly targets a hypothesis across multiple analysis runs', () => {
    const firstRunHypothesis = buildHypothesis({ id: 'hyp-old', status: 'proposed' });
    const secondRunHypothesis = buildHypothesis({ id: 'hyp-new', status: 'proposed' });
    const incident = buildIncident({
      analysisRuns: [buildRun([firstRunHypothesis]), buildRun([secondRunHypothesis])],
    });

    const updated = applyOptimisticHypothesisStatusUpdate(incident, 'hyp-new', { status: 'supported' });
    expect(updated.analysisRuns[0]?.hypotheses[0]?.status).toBe('proposed');
    expect(updated.analysisRuns[1]?.hypotheses[0]?.status).toBe('supported');
  });
});
