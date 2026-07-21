import { describe, expect, it } from 'vitest';
import { detectUnsupportedFacts } from '../src/ai/validators/unsupportedClaimDetector.js';
import type { AiFact } from '../src/ai/schemas/aiAnalysisResponse.schema.js';

function buildFact(overrides: Partial<AiFact> = {}): AiFact {
  return {
    statement: 'checkout-api returned 500 errors.',
    explanation: 'Observed in logs.',
    evidenceIds: ['evidence-1'],
    confidence: 80,
    ...overrides,
  };
}

describe('detectUnsupportedFacts', () => {
  it('does not flag a fact with at least one valid evidence id', () => {
    const facts = [buildFact({ evidenceIds: ['evidence-1', 'bogus'] })];
    expect(detectUnsupportedFacts(facts, new Set(['evidence-1']))).toEqual([]);
  });

  it('flags a fact whose evidence ids are all unknown', () => {
    const fact = buildFact({ evidenceIds: ['bogus-1', 'bogus-2'] });
    const result = detectUnsupportedFacts([fact], new Set(['evidence-1']));
    expect(result).toEqual([fact.statement]);
  });

  it('returns nothing for an empty facts list', () => {
    expect(detectUnsupportedFacts([], new Set(['evidence-1']))).toEqual([]);
  });
});
