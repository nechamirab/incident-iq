import { describe, expect, it } from 'vitest';
import { sortIncidentsByUpdatedAt } from '../src/utils/sortIncidentsByUpdatedAt';
import { buildIncident } from './helpers/incidentFixture';

describe('sortIncidentsByUpdatedAt', () => {
  it('orders incidents most recently updated first', () => {
    const oldest = buildIncident({ id: 'oldest', updatedAt: '2026-07-01T00:00:00Z' });
    const newest = buildIncident({ id: 'newest', updatedAt: '2026-07-03T00:00:00Z' });
    const middle = buildIncident({ id: 'middle', updatedAt: '2026-07-02T00:00:00Z' });

    const sorted = sortIncidentsByUpdatedAt([oldest, newest, middle]);
    expect(sorted.map((i) => i.id)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('does not mutate the input array', () => {
    const incidents = [
      buildIncident({ id: 'a', updatedAt: '2026-07-01T00:00:00Z' }),
      buildIncident({ id: 'b', updatedAt: '2026-07-02T00:00:00Z' }),
    ];
    const original = [...incidents];
    sortIncidentsByUpdatedAt(incidents);
    expect(incidents).toEqual(original);
  });

  it('returns an empty array for empty input', () => {
    expect(sortIncidentsByUpdatedAt([])).toEqual([]);
  });

  it('preserves relative order for incidents with the same updatedAt', () => {
    const first = buildIncident({ id: 'first', updatedAt: '2026-07-01T00:00:00Z' });
    const second = buildIncident({ id: 'second', updatedAt: '2026-07-01T00:00:00Z' });
    expect(sortIncidentsByUpdatedAt([first, second]).map((i) => i.id)).toEqual(['first', 'second']);
  });
});
