import { describe, expect, it } from 'vitest';
import { runSkepticReviewEvaluationExperiment } from '../../src/experiments/skepticReviewEvaluationExperiment.js';
import { MockAIProvider } from '../../src/ai/providers/MockAIProvider.js';
import { sampleIncidents } from '../../src/data/incidents/index.js';

const incident = sampleIncidents.find((item) => item.id === 'sample-db-connection-leak')!;

describe('runSkepticReviewEvaluationExperiment (Experiment D)', () => {
  it('is meaningful in mock-only mode: scores the deterministic mock skeptic review against all six criteria', async () => {
    const mockProvider = new MockAIProvider();
    const result = await runSkepticReviewEvaluationExperiment({
      incident,
      mockProvider,
      reviewProvider: mockProvider,
      reviewGate: { allowed: true },
    });

    expect(result.reviewLeg.status).toBe('ran');
    if (result.reviewLeg.status === 'ran') {
      expect(result.reviewLeg.result.criteria).toHaveLength(6);
      for (const criterion of result.reviewLeg.result.criteria) {
        expect(typeof criterion.passed).toBe('boolean');
        expect(criterion.detail.length).toBeGreaterThan(0);
      }
      // The mock skeptic review names the leading hypothesis explicitly in its challengeSummary.
      expect(
        result.reviewLeg.result.criteria.find((c) => c.id === 'challenges-leading-hypothesis-by-name')?.passed,
      ).toBe(true);
    }
  });

  it('produces a real baseline analysis run, not a placeholder', async () => {
    const mockProvider = new MockAIProvider();
    const result = await runSkepticReviewEvaluationExperiment({
      incident,
      mockProvider,
      reviewProvider: mockProvider,
      reviewGate: { allowed: true },
    });

    expect(result.baselineRun.hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(result.baselineRun.incidentId).toBe(incident.id);
  });
});
