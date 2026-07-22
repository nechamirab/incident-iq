import type { Incident } from '../../shared/types/incident';

/**
 * Sorts incidents by `updatedAt`, most recently updated first (ISO-8601 UTC
 * timestamps sort lexicographically the same as chronologically). Does not
 * mutate the input array; stable for equal timestamps.
 */
export function sortIncidentsByUpdatedAt(incidents: readonly Incident[]): Incident[] {
  return [...incidents].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
}
