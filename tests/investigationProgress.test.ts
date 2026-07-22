import { describe, expect, it } from 'vitest';
import { getInvestigationSteps } from '../src/utils/investigationProgress';
import { buildIncident, buildEvidenceItem } from './helpers/incidentFixture';
import { buildAnalysisRun } from './helpers/analysisRunFixture';
import type { Hypothesis } from '../shared/types/hypothesis';
import type { BiasFinding } from '../shared/types/bias';
import type { SkepticReview } from '../shared/types/skepticReview';
import type { Postmortem } from '../shared/types/postmortem';

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

function buildBiasFinding(overrides: Partial<BiasFinding> = {}): BiasFinding {
  return {
    id: 'bias-1',
    biasType: 'automation-bias',
    title: 'A risk',
    description: 'x',
    detectedIn: 'overall-analysis',
    evidenceIds: [],
    riskLevel: 'medium',
    mitigation: 'x',
    ...overrides,
  };
}

function buildSkepticReview(overrides: Partial<SkepticReview> = {}): SkepticReview {
  return {
    id: 'review-1',
    incidentId: 'incident-1',
    analysisRunId: 'run-1',
    provider: 'mock',
    model: 'mock-deterministic-v1',
    promptVersion: 'skeptic-review-v1',
    createdAt: '2026-07-01T00:10:00Z',
    durationMs: 5,
    challengedHypothesisId: 'hyp-1',
    challengeSummary: 'x',
    alternativeExplanations: [],
    ignoredEvidenceIds: [],
    confirmationBiasAssessment: 'x',
    falsificationTest: 'x',
    recommendedTests: [],
    overallAssessment: 'x',
    humanNotes: null,
    rawResponse: null,
    ...overrides,
  };
}

function buildPostmortem(overrides: Partial<Postmortem> = {}): Postmortem {
  return {
    incidentSummary: 'x',
    impact: 'x',
    detection: 'x',
    timeline: 'x',
    contributingFactors: [],
    hypothesesInvestigated: [],
    likelyCause: 'x',
    uncertaintyStatement: 'x',
    resolution: 'x',
    correctiveActions: [],
    lessonsLearned: [],
    followUpItems: [],
    provider: 'mock',
    model: 'mock-deterministic-v1',
    promptVersion: 'postmortem-v1',
    generatedAt: '2026-07-01T00:20:00Z',
    lastEditedAt: null,
    ...overrides,
  };
}

const STEP_IDS = [
  'review-evidence',
  'analyze-hypothesize',
  'evaluate-risks',
  'draft-postmortem',
  'resolve-incident',
];

describe('getInvestigationSteps', () => {
  it('marks every step pending except the first, which is current, for a brand-new incident', () => {
    const incident = buildIncident({ evidence: [], analysisRuns: [], skepticReviews: [], postmortem: null });
    const steps = getInvestigationSteps(incident);

    expect(steps.map((s) => s.id)).toEqual(STEP_IDS);
    expect(steps[0].state).toBe('current');
    expect(steps.slice(1).every((s) => s.state === 'pending')).toBe(true);
  });

  it('completes "review evidence" once at least one evidence item exists, and moves current to step 2', () => {
    const incident = buildIncident({ evidence: [buildEvidenceItem()] });
    const steps = getInvestigationSteps(incident);

    expect(steps[0].state).toBe('completed');
    expect(steps[1].state).toBe('current');
    expect(steps[2].state).toBe('pending');
  });

  it('does not complete "analyze and hypothesize" when a run exists but produced no hypotheses', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ hypotheses: [] })],
    });
    const steps = getInvestigationSteps(incident);

    expect(steps[1].state).toBe('current');
  });

  it('does not complete "analyze and hypothesize" from a failed analysis run', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ status: 'failed', hypotheses: [buildHypothesis()] })],
    });
    const steps = getInvestigationSteps(incident);

    expect(steps[1].state).toBe('current');
  });

  it('completes "analyze and hypothesize" once a successful run produced hypotheses', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ hypotheses: [buildHypothesis()] })],
    });
    const steps = getInvestigationSteps(incident);

    expect(steps[1].state).toBe('completed');
    expect(steps[2].state).toBe('current');
  });

  it('requires both reasoning risks and a skeptic review to complete "evaluate risks"', () => {
    const withRisksOnly = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ hypotheses: [buildHypothesis()], reasoningRisks: [buildBiasFinding()] })],
      skepticReviews: [],
    });
    expect(getInvestigationSteps(withRisksOnly)[2].state).toBe('current');

    const withSkepticReviewOnly = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ hypotheses: [buildHypothesis()], reasoningRisks: [] })],
      skepticReviews: [buildSkepticReview()],
    });
    expect(getInvestigationSteps(withSkepticReviewOnly)[2].state).toBe('current');

    const withBoth = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ hypotheses: [buildHypothesis()], reasoningRisks: [buildBiasFinding()] })],
      skepticReviews: [buildSkepticReview()],
    });
    expect(getInvestigationSteps(withBoth)[2].state).toBe('completed');
  });

  it('completes "draft postmortem" once a postmortem exists', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ hypotheses: [buildHypothesis()], reasoningRisks: [buildBiasFinding()] })],
      skepticReviews: [buildSkepticReview()],
      postmortem: buildPostmortem(),
    });
    const steps = getInvestigationSteps(incident);

    expect(steps[3].state).toBe('completed');
    expect(steps[4].state).toBe('current');
  });

  it('completes "resolve incident" only when status is "resolved"', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ hypotheses: [buildHypothesis()], reasoningRisks: [buildBiasFinding()] })],
      skepticReviews: [buildSkepticReview()],
      postmortem: buildPostmortem(),
      status: 'resolved',
    });
    const steps = getInvestigationSteps(incident);

    expect(steps[4].state).toBe('completed');
    expect(steps.every((s) => s.state !== 'current')).toBe(true);
  });

  it('handles steps completed out of order: a postmortem drafted before a skeptic review exists', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ hypotheses: [buildHypothesis()], reasoningRisks: [buildBiasFinding()] })],
      skepticReviews: [],
      postmortem: buildPostmortem(),
    });
    const steps = getInvestigationSteps(incident);

    // Step 3 (evaluate risks) is still incomplete and current...
    expect(steps[2].state).toBe('current');
    // ...but step 4 (draft postmortem) is independently derived and still shows completed.
    expect(steps[3].state).toBe('completed');
  });

  it('does not treat status as the sole source of progress: "resolved" with no evidence still leaves step 1 incomplete', () => {
    const incident = buildIncident({ evidence: [], analysisRuns: [], skepticReviews: [], postmortem: null, status: 'resolved' });
    const steps = getInvestigationSteps(incident);

    expect(steps[0].state).toBe('current');
    expect(steps[4].state).toBe('completed');
  });

  it('maps each step to its target workspace tab, with "resolve incident" targeting no tab', () => {
    const incident = buildIncident();
    const steps = getInvestigationSteps(incident);

    expect(steps[0].targetSection).toBe('evidence');
    expect(steps[1].targetSection).toBe('hypotheses');
    expect(steps[2].targetSection).toBe('ai-review');
    expect(steps[3].targetSection).toBe('postmortem');
    expect(steps[4].targetSection).toBeNull();
  });

  it('assigns each step a 1-based order matching its position', () => {
    const steps = getInvestigationSteps(buildIncident());
    expect(steps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
  });
});
