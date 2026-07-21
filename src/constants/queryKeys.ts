/**
 * Centralized TanStack Query key factory, so cache keys are never
 * hand-written (and risk drifting) at each call site.
 */
export const queryKeys = {
  health: ['health'] as const,
};
