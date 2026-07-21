import type { ActionPriority, RecommendedAction } from '../../shared/types/action';

const PRIORITY_RANK: Record<ActionPriority, number> = {
  immediate: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Sorts recommended actions by priority (immediate first, low last), per
 * the "display actions ordered by priority" requirement. Does not mutate
 * the input array.
 */
export function sortActionsByPriority(actions: readonly RecommendedAction[]): RecommendedAction[] {
  return [...actions].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}
