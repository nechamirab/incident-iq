import { describe, expect, it } from 'vitest';
import { evaluateSkepticReviewCriteria } from '../../src/experiments/skepticReviewCriteria.js';
import { sampleIncidents } from '../../src/data/incidents/index.js';
import { buildAnalysisRun } from '../helpers/analysisRunFixture.js';
import { buildValidSkepticReviewResponse } from '../helpers/aiResponseFixtures.js';

const incident = sampleIncidents[0];
const evidenceId = incident.evidence[0].id;

describe('evaluateSkepticReviewCriteria', () => {
  it('returns exactly six criteria', () => {
    const run = buildAnalysisRun(incident, evidenceId);
    const review = buildValidSkepticReviewResponse();
    expect(evaluateSkepticReviewCriteria(review, run)).toHaveLength(6);
  });

  it('fails "challenges leading hypothesis by name" when the challenge summary never mentions it', () => {
    const run = buildAnalysisRun(incident, evidenceId);
    const review = buildValidSkepticReviewResponse({ challengeSummary: 'A generic critique with no specifics.' });
    const criteria = evaluateSkepticReviewCriteria(review, run);
    const result = criteria.find((c) => c.id === 'challenges-leading-hypothesis-by-name');
    expect(result?.passed).toBe(false);
  });

  it('passes "challenges leading hypothesis by name" when it does mention the leading hypothesis title', () => {
    const run = buildAnalysisRun(incident, evidenceId);
    const review = buildValidSkepticReviewResponse({
      challengeSummary: 'The hypothesis "Hypothesis one" rests on a narrow slice of evidence.',
    });
    const criteria = evaluateSkepticReviewCriteria(review, run);
    expect(criteria.find((c) => c.id === 'challenges-leading-hypothesis-by-name')?.passed).toBe(true);
  });

  it('fails "recommends concrete tests" when every recommended test is a generic phrase', () => {
    const run = buildAnalysisRun(incident, evidenceId);
    const review = buildValidSkepticReviewResponse({ recommendedTests: ['Investigate further', 'Check the logs'] });
    const criteria = evaluateSkepticReviewCriteria(review, run);
    expect(criteria.find((c) => c.id === 'recommends-concrete-tests')?.passed).toBe(false);
  });

  it('fails "avoids overconfident language" when certainty language appears anywhere', () => {
    const run = buildAnalysisRun(incident, evidenceId);
    const review = buildValidSkepticReviewResponse({
      overallAssessment: 'This is the definitive root cause, without a doubt.',
    });
    const criteria = evaluateSkepticReviewCriteria(review, run);
    expect(criteria.find((c) => c.id === 'avoids-overconfident-language')?.passed).toBe(false);
  });

  it('passes every criterion for a genuinely thorough, concrete, non-overconfident review', () => {
    const run = buildAnalysisRun(incident, evidenceId);
    const review = buildValidSkepticReviewResponse({
      challengeSummary:
        'The hypothesis "Hypothesis one" is supported by a narrow slice of evidence and has not been stress-tested.',
      recommendedTests: ['Independently verify the connection-pool metrics behind hypothesis one before treating it as likely.'],
      falsificationTest: 'If the same error pattern also occurs during a known-healthy period, this hypothesis is falsified.',
    });
    const criteria = evaluateSkepticReviewCriteria(review, run);
    expect(criteria.every((c) => c.passed)).toBe(true);
  });
});
