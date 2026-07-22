import { describe, expect, it } from 'vitest';
import { mapAiResponseToSkepticReview } from '../src/ai/mapSkepticReviewResponse.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { buildAnalysisRun } from './helpers/analysisRunFixture.js';
import { buildValidSkepticReviewResponse } from './helpers/aiResponseFixtures.js';

const incident = sampleIncidents[0];
const evidenceId = incident.evidence[0].id;

function mapWith(overrides: Parameters<typeof buildValidSkepticReviewResponse>[0] = {}) {
  const run = buildAnalysisRun(incident, evidenceId);
  return {
    run,
    review: mapAiResponseToSkepticReview({
      incident,
      run,
      response: buildValidSkepticReviewResponse(overrides),
      providerName: 'mock',
      model: 'test-model',
      promptVersion: 'skeptic-review-v1',
      durationMs: 5,
      rawResponse: { rawText: '{}', repaired: false },
    }),
  };
}

describe('mapAiResponseToSkepticReview', () => {
  it('stamps the review with the given provider, model, prompt version, and linkage ids', () => {
    const { run, review } = mapWith();
    expect(review.incidentId).toBe(incident.id);
    expect(review.analysisRunId).toBe(run.id);
    expect(review.provider).toBe('mock');
    expect(review.model).toBe('test-model');
    expect(review.promptVersion).toBe('skeptic-review-v1');
    expect(review.durationMs).toBe(5);
  });

  it('challenges the highest-confidence hypothesis, computed itself rather than trusted from the AI', () => {
    const { run, review } = mapWith();
    // buildValidAiResponse's H1 has confidence 50, the highest of the three.
    expect(review.challengedHypothesisId).toBe(run.hypotheses[0].id);
  });

  it('computes ignoredEvidenceIds as every evidence id never cited anywhere in the run', () => {
    const { review } = mapWith();
    const citedElsewhere = evidenceId;
    expect(review.ignoredEvidenceIds).not.toContain(citedElsewhere);
    for (const item of incident.evidence) {
      if (item.id !== citedElsewhere) {
        expect(review.ignoredEvidenceIds).toContain(item.id);
      }
    }
  });

  it('starts with no human notes', () => {
    const { review } = mapWith();
    expect(review.humanNotes).toBeNull();
  });

  it('carries the AI-provided qualitative content through unchanged', () => {
    const { review } = mapWith({ challengeSummary: 'A custom challenge summary.' });
    expect(review.challengeSummary).toBe('A custom challenge summary.');
  });

  it('generates a unique id and a valid createdAt timestamp', () => {
    const { review } = mapWith();
    expect(review.id).toBeTruthy();
    expect(Number.isNaN(Date.parse(review.createdAt))).toBe(false);
  });
});
