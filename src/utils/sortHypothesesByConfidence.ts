import type { Hypothesis } from '../../shared/types/hypothesis';

/**
 * Sorts hypotheses by confidence, highest first, so the most-supported
 * candidate explanation is presented before less-supported ones. Confidence
 * is an investigation aid, not a definitive ranking of correctness -- the
 * UI must still show every hypothesis with equal detail. Does not mutate
 * the input array.
 */
export function sortHypothesesByConfidence(hypotheses: readonly Hypothesis[]): Hypothesis[] {
  return [...hypotheses].sort((a, b) => b.confidence - a.confidence);
}
