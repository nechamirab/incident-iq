import type { TimelineEvent } from '../../shared/types/timeline';

/**
 * Sorts timeline events chronologically (earliest first). Applied
 * defensively in the UI even though the backend already returns events in
 * order, so the Timeline is guaranteed correct regardless of provider
 * behavior. Does not mutate the input array.
 */
export function sortTimelineEvents(events: readonly TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    if (a.timestamp < b.timestamp) return -1;
    if (a.timestamp > b.timestamp) return 1;
    return 0;
  });
}
