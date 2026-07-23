import { describe, expect, it } from 'vitest';
import {
  evaluateAnalysisQuality,
  identifyRepairableDeficiencies,
} from '../src/ai/validators/analysisQualityEvaluator.js';
import { buildValidAiResponse } from './helpers/aiResponseFixtures.js';

describe('evaluateAnalysisQuality', () => {
  it('reports no warnings for a complete, evidence-grounded response', () => {
    const response = buildValidAiResponse();
    const report = evaluateAnalysisQuality(response, 10);
    expect(report.completenessWarnings).toEqual([]);
    expect(report.qualityWarnings).toEqual([]);
  });

  it('flags an empty reasoningRisks array as a completeness warning', () => {
    const response = buildValidAiResponse({ reasoningRisks: [] });
    const report = evaluateAnalysisQuality(response, 10);
    expect(report.completenessWarnings.some((w) => w.includes('reasoning risks'))).toBe(true);
  });

  it('flags an empty recommendedActions array as a completeness warning', () => {
    const response = buildValidAiResponse({ recommendedActions: [] });
    const report = evaluateAnalysisQuality(response, 10);
    expect(report.completenessWarnings.some((w) => w.includes('recommended actions'))).toBe(true);
  });

  it('flags an empty openQuestions array as a completeness warning', () => {
    const response = buildValidAiResponse({ openQuestions: [] });
    const report = evaluateAnalysisQuality(response, 10);
    expect(report.completenessWarnings.some((w) => w.includes('open questions'))).toBe(true);
  });

  it('flags a trivial uncertainty statement as a completeness warning', () => {
    const response = buildValidAiResponse({ uncertaintyStatement: 'Unsure.' });
    const report = evaluateAnalysisQuality(response, 10);
    expect(report.completenessWarnings.some((w) => w.includes('uncertainty statement'))).toBe(true);
  });

  it('does NOT flag all-hypotheses-missing-contradicting-evidence for a sparse incident', () => {
    const response = buildValidAiResponse();
    response.hypotheses.forEach((h) => (h.contradictingEvidenceIds = []));
    const report = evaluateAnalysisQuality(response, 2);
    expect(report.qualityWarnings.some((w) => w.includes('contradicting-evidence'))).toBe(false);
  });

  it('flags all-hypotheses-missing-contradicting-evidence as a quality warning for a rich incident', () => {
    const response = buildValidAiResponse();
    response.hypotheses.forEach((h) => (h.contradictingEvidenceIds = []));
    const report = evaluateAnalysisQuality(response, 8);
    expect(report.qualityWarnings.some((w) => w.includes('contradicting-evidence list'))).toBe(true);
  });

  it('never treats a genuinely-no-contradicting-evidence case as invalid -- only ever a warning', () => {
    const response = buildValidAiResponse();
    response.hypotheses.forEach((h) => (h.contradictingEvidenceIds = []));
    const report = evaluateAnalysisQuality(response, 8);
    // A report is purely advisory: it has no success/valid field to fail.
    expect(report).not.toHaveProperty('valid');
    expect(report).not.toHaveProperty('success');
  });

  it('flags a generic recommended action with no evidence/hypothesis link', () => {
    const response = buildValidAiResponse({
      recommendedActions: [
        {
          title: 'Check the logs',
          description: 'Investigate further.',
          priority: 'medium',
          category: 'inspect',
          relatedHypothesisIds: [],
          evidenceIds: [],
          expectedOutcome: 'Unclear.',
          risk: 'Low.',
        },
      ],
    });
    const report = evaluateAnalysisQuality(response, 10);
    expect(report.qualityWarnings.some((w) => w.includes('generic') && w.includes('Check the logs'))).toBe(true);
  });

  it('does not flag a concrete, evidence-linked action even if its wording is plain', () => {
    const response = buildValidAiResponse({
      recommendedActions: [
        {
          title: 'Check the logs for connection-pool exhaustion errors between 14:30 and 15:00',
          description: 'Search checkout-api logs for the exact error signature in evidence-1.',
          priority: 'high',
          category: 'inspect',
          relatedHypothesisIds: ['H1'],
          evidenceIds: ['evidence-1'],
          expectedOutcome: 'Confirms or rules out hypothesis one.',
          risk: 'Low.',
        },
      ],
    });
    const report = evaluateAnalysisQuality(response, 10);
    expect(report.qualityWarnings.some((w) => w.includes('generic'))).toBe(false);
  });

  it('flags overconfident language anywhere in the response text', () => {
    const response = buildValidAiResponse({
      summary: {
        text: 'This was definitely caused by the deployment.',
        affectedComponents: ['checkout-api'],
        impact: 'x',
      },
    });
    const report = evaluateAnalysisQuality(response, 10);
    expect(report.qualityWarnings.some((w) => w.includes('unwarranted certainty'))).toBe(true);
  });
});

describe('identifyRepairableDeficiencies', () => {
  it('returns an empty list for a complete response', () => {
    expect(identifyRepairableDeficiencies(buildValidAiResponse(), 10)).toEqual([]);
  });

  it('identifies empty-reasoning-risks', () => {
    const response = buildValidAiResponse({ reasoningRisks: [] });
    expect(identifyRepairableDeficiencies(response, 10)).toContain('empty-reasoning-risks');
  });

  it('identifies empty-recommended-actions', () => {
    const response = buildValidAiResponse({ recommendedActions: [] });
    expect(identifyRepairableDeficiencies(response, 10)).toContain('empty-recommended-actions');
  });

  it('identifies all-hypotheses-missing-contradicting-evidence only for a rich evidence set', () => {
    const response = buildValidAiResponse();
    response.hypotheses.forEach((h) => (h.contradictingEvidenceIds = []));
    expect(identifyRepairableDeficiencies(response, 2)).not.toContain(
      'all-hypotheses-missing-contradicting-evidence',
    );
    expect(identifyRepairableDeficiencies(response, 8)).toContain(
      'all-hypotheses-missing-contradicting-evidence',
    );
  });
});
