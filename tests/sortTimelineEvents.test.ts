import { describe, expect, it } from 'vitest';
import { sortTimelineEvents } from '../src/utils/sortTimelineEvents';
import type { TimelineEvent } from '../shared/types/timeline';

function buildEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'tl-1',
    timestamp: '2026-06-14T14:00:00Z',
    title: 'Event',
    description: 'desc',
    evidenceIds: [],
    timestampType: 'exact',
    confidence: 90,
    isInferred: false,
    ...overrides,
  };
}

describe('sortTimelineEvents', () => {
  it('sorts events chronologically, earliest first', () => {
    const late = buildEvent({ id: 'late', timestamp: '2026-06-14T15:00:00Z' });
    const early = buildEvent({ id: 'early', timestamp: '2026-06-14T13:00:00Z' });
    const mid = buildEvent({ id: 'mid', timestamp: '2026-06-14T14:00:00Z' });

    const sorted = sortTimelineEvents([late, early, mid]);
    expect(sorted.map((event) => event.id)).toEqual(['early', 'mid', 'late']);
  });

  it('does not mutate the input array', () => {
    const events = [
      buildEvent({ id: 'b', timestamp: '2026-06-14T15:00:00Z' }),
      buildEvent({ id: 'a', timestamp: '2026-06-14T13:00:00Z' }),
    ];
    const original = [...events];
    sortTimelineEvents(events);
    expect(events).toEqual(original);
  });

  it('returns an empty array for empty input', () => {
    expect(sortTimelineEvents([])).toEqual([]);
  });

  it('leaves an already-sorted array in the same order', () => {
    const events = [
      buildEvent({ id: 'a', timestamp: '2026-06-14T13:00:00Z' }),
      buildEvent({ id: 'b', timestamp: '2026-06-14T14:00:00Z' }),
    ];
    expect(sortTimelineEvents(events).map((event) => event.id)).toEqual(['a', 'b']);
  });
});
