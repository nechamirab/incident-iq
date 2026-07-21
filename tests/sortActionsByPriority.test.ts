import { describe, expect, it } from 'vitest';
import { sortActionsByPriority } from '../src/utils/sortActionsByPriority';
import type { RecommendedAction } from '../shared/types/action';

function buildAction(overrides: Partial<RecommendedAction> = {}): RecommendedAction {
  return {
    id: 'act-1',
    title: 'An action',
    description: 'desc',
    priority: 'medium',
    category: 'inspect',
    relatedHypothesisIds: [],
    evidenceIds: [],
    expectedOutcome: 'outcome',
    risk: 'low',
    status: 'suggested',
    ...overrides,
  };
}

describe('sortActionsByPriority', () => {
  it('orders actions immediate, high, medium, low', () => {
    const low = buildAction({ id: 'low', priority: 'low' });
    const immediate = buildAction({ id: 'immediate', priority: 'immediate' });
    const medium = buildAction({ id: 'medium', priority: 'medium' });
    const high = buildAction({ id: 'high', priority: 'high' });

    const sorted = sortActionsByPriority([low, medium, high, immediate]);
    expect(sorted.map((a) => a.id)).toEqual(['immediate', 'high', 'medium', 'low']);
  });

  it('does not mutate the input array', () => {
    const actions = [buildAction({ id: 'a', priority: 'low' }), buildAction({ id: 'b', priority: 'immediate' })];
    const original = [...actions];
    sortActionsByPriority(actions);
    expect(actions).toEqual(original);
  });

  it('returns an empty array for empty input', () => {
    expect(sortActionsByPriority([])).toEqual([]);
  });

  it('preserves relative order for actions with the same priority', () => {
    const first = buildAction({ id: 'first', priority: 'high' });
    const second = buildAction({ id: 'second', priority: 'high' });
    expect(sortActionsByPriority([first, second]).map((a) => a.id)).toEqual(['first', 'second']);
  });
});
