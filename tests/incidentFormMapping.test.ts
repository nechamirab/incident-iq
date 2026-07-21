import { describe, expect, it } from 'vitest';
import {
  buildFormValuesFromIncident,
  toDatetimeLocalValue,
} from '../src/utils/incidentFormMapping';
import type { Incident } from '../shared/types/incident';

function buildIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'sample-1',
    title: 'Checkout failures',
    description: 'Customers cannot complete checkout.',
    scenarioType: 'ecommerce-checkout',
    status: 'draft',
    severity: 'critical',
    affectedService: 'checkout-api',
    startedAt: '2026-06-14T14:30:00Z',
    detectedAt: '2026-06-14T14:41:00Z',
    resolvedAt: null,
    createdAt: '2026-06-14T14:41:00Z',
    updatedAt: '2026-06-14T14:41:00Z',
    evidence: [],
    analysisRuns: [],
    ...overrides,
  };
}

describe('toDatetimeLocalValue', () => {
  it('formats an ISO timestamp as YYYY-MM-DDTHH:mm', () => {
    const value = toDatetimeLocalValue('2026-06-14T14:41:00Z');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('buildFormValuesFromIncident', () => {
  it('copies top-level metadata fields directly', () => {
    const values = buildFormValuesFromIncident(buildIncident());
    expect(values.title).toBe('Checkout failures');
    expect(values.description).toBe('Customers cannot complete checkout.');
    expect(values.severity).toBe('critical');
    expect(values.affectedService).toBe('checkout-api');
    expect(values.scenarioType).toBe('ecommerce-checkout');
  });

  it('leaves startedAt blank when the incident has none', () => {
    const values = buildFormValuesFromIncident(buildIncident({ startedAt: null }));
    expect(values.startedAt).toBe('');
  });

  it('groups evidence back into the matching textarea field by source type', () => {
    const incident = buildIncident({
      evidence: [
        {
          id: 'ev-1',
          incidentId: 'sample-1',
          sourceType: 'application-log',
          sourceName: 'Application logs',
          originalContent: 'first log line',
          normalizedContent: 'first log line',
          timestamp: null,
          lineNumber: 1,
          metadata: {},
          createdAt: '2026-06-14T14:41:00Z',
        },
        {
          id: 'ev-2',
          incidentId: 'sample-1',
          sourceType: 'application-log',
          sourceName: 'Application logs',
          originalContent: 'second log line',
          normalizedContent: 'second log line',
          timestamp: null,
          lineNumber: 2,
          metadata: {},
          createdAt: '2026-06-14T14:41:00Z',
        },
        {
          id: 'ev-3',
          incidentId: 'sample-1',
          sourceType: 'database-error',
          sourceName: 'Database errors',
          originalContent: 'DB timeout',
          normalizedContent: 'DB timeout',
          timestamp: null,
          lineNumber: 1,
          metadata: {},
          createdAt: '2026-06-14T14:41:00Z',
        },
      ],
    });

    const values = buildFormValuesFromIncident(incident);
    expect(values.applicationLogs).toBe('first log line\nsecond log line');
    expect(values.databaseErrors).toBe('DB timeout');
    expect(values.errorTraces).toBe('');
  });

  it('does not reconstruct evidence with no matching form field (e.g. uploaded-file)', () => {
    const incident = buildIncident({
      evidence: [
        {
          id: 'ev-1',
          incidentId: 'sample-1',
          sourceType: 'uploaded-file',
          sourceName: 'notes.txt',
          originalContent: 'from a file',
          normalizedContent: 'from a file',
          timestamp: null,
          lineNumber: 1,
          metadata: {},
          createdAt: '2026-06-14T14:41:00Z',
        },
      ],
    });

    const values = buildFormValuesFromIncident(incident);
    expect(Object.values(values).some((value) => value === 'from a file')).toBe(false);
  });
});
