import { describe, expect, it } from 'vitest';
import { summarizeIncidentsByStatus } from '../src/utils/summarizeIncidentsByStatus';
import { buildIncident } from './helpers/incidentFixture';

describe('summarizeIncidentsByStatus', () => {
  it('counts incidents per status, including zero-count statuses', () => {
    const incidents = [
      buildIncident({ id: 'a', status: 'draft' }),
      buildIncident({ id: 'b', status: 'draft' }),
      buildIncident({ id: 'c', status: 'resolved' }),
    ];

    const summary = summarizeIncidentsByStatus(incidents);
    expect(summary).toEqual([
      { status: 'draft', count: 2 },
      { status: 'analyzing', count: 0 },
      { status: 'under-investigation', count: 0 },
      { status: 'resolved', count: 1 },
      { status: 'archived', count: 0 },
    ]);
  });

  it('returns every status at zero for an empty incident list', () => {
    const summary = summarizeIncidentsByStatus([]);
    expect(summary.every((row) => row.count === 0)).toBe(true);
    expect(summary).toHaveLength(5);
  });

  it('always returns statuses in the same fixed lifecycle order', () => {
    const summary = summarizeIncidentsByStatus([buildIncident({ status: 'archived' })]);
    expect(summary.map((row) => row.status)).toEqual([
      'draft',
      'analyzing',
      'under-investigation',
      'resolved',
      'archived',
    ]);
  });
});
