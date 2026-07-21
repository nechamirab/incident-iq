import { describe, expect, it } from 'vitest';
import { sortHypothesesByConfidence } from '../src/utils/sortHypothesesByConfidence';
import type { Hypothesis } from '../shared/types/hypothesis';

function buildHypothesis(overrides: Partial<Hypothesis> = {}): Hypothesis {
  return {
    id: 'hyp-1',
    title: 'A hypothesis',
    description: 'desc',
    confidence: 50,
    confidenceReason: 'reason',
    supportingEvidenceIds: [],
    contradictingEvidenceIds: [],
    assumptions: [],
    recommendedTest: 'test',
    expectedResult: 'result',
    status: 'proposed',
    ...overrides,
  };
}

describe('sortHypothesesByConfidence', () => {
  it('sorts hypotheses by confidence, highest first', () => {
    const low = buildHypothesis({ id: 'low', confidence: 20 });
    const high = buildHypothesis({ id: 'high', confidence: 80 });
    const mid = buildHypothesis({ id: 'mid', confidence: 50 });

    const sorted = sortHypothesesByConfidence([low, high, mid]);
    expect(sorted.map((h) => h.id)).toEqual(['high', 'mid', 'low']);
  });

  it('does not mutate the input array', () => {
    const hypotheses = [buildHypothesis({ id: 'a', confidence: 20 }), buildHypothesis({ id: 'b', confidence: 80 })];
    const original = [...hypotheses];
    sortHypothesesByConfidence(hypotheses);
    expect(hypotheses).toEqual(original);
  });

  it('returns an empty array for empty input', () => {
    expect(sortHypothesesByConfidence([])).toEqual([]);
  });
});
