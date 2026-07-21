import { describe, expect, it } from 'vitest';
import { buildEvidenceFromIntake } from '../src/services/evidenceService.js';
import type { IncidentIntakeRequest } from '../src/schemas/incidentIntake.schema.js';

const INCIDENT_ID = 'incident-1';

function buildIntake(overrides: Partial<IncidentIntakeRequest> = {}): IncidentIntakeRequest {
  return {
    title: 'Test incident',
    description: 'Something went wrong.',
    severity: 'high',
    affectedService: 'checkout-api',
    detectedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildEvidenceFromIntake', () => {
  it('always includes exactly one evidence item for the description', () => {
    const evidence = buildEvidenceFromIntake(INCIDENT_ID, buildIntake(), []);
    const descriptionItems = evidence.filter((item) => item.sourceType === 'incident-description');
    expect(descriptionItems).toHaveLength(1);
    expect(descriptionItems[0].originalContent).toBe('Something went wrong.');
  });

  it('maps each free-form field to its dedicated evidence source type', () => {
    const evidence = buildEvidenceFromIntake(
      INCIDENT_ID,
      buildIntake({
        applicationLogs: 'log line 1',
        errorTraces: 'trace line 1',
        monitoringAlerts: 'alert line 1',
        deploymentNotes: 'deploy note 1',
        userComplaints: 'complaint 1',
        apiErrors: 'api error 1',
        databaseErrors: 'db error 1',
      }),
      [],
    );

    const sourceTypes = evidence.map((item) => item.sourceType).sort();
    expect(sourceTypes).toEqual(
      [
        'api-error',
        'application-log',
        'database-error',
        'deployment-note',
        'error-trace',
        'incident-description',
        'monitoring-alert',
        'user-report',
      ].sort(),
    );
  });

  it('produces no evidence for empty/omitted optional fields', () => {
    const evidence = buildEvidenceFromIntake(INCIDENT_ID, buildIntake({ applicationLogs: '' }), []);
    expect(evidence.some((item) => item.sourceType === 'application-log')).toBe(false);
  });

  it('tags every uploaded file evidence item as uploaded-file regardless of parser', () => {
    const evidence = buildEvidenceFromIntake(INCIDENT_ID, buildIntake(), [
      { originalName: 'log.txt', buffer: Buffer.from('a line') },
      { originalName: 'data.json', buffer: Buffer.from('{"x":1}') },
      { originalName: 'rows.csv', buffer: Buffer.from('a\n1') },
    ]);

    const fromFiles = evidence.filter((item) => item.sourceName.match(/\.(txt|json|csv)$/));
    expect(fromFiles.length).toBeGreaterThanOrEqual(3);
    expect(fromFiles.every((item) => item.sourceType === 'uploaded-file')).toBe(true);
  });

  it('stamps every evidence item with the same incidentId', () => {
    const evidence = buildEvidenceFromIntake(INCIDENT_ID, buildIntake({ applicationLogs: 'x' }), [
      { originalName: 'log.txt', buffer: Buffer.from('y') },
    ]);
    expect(evidence.every((item) => item.incidentId === INCIDENT_ID)).toBe(true);
  });

  it('gives every evidence item a unique id', () => {
    const evidence = buildEvidenceFromIntake(
      INCIDENT_ID,
      buildIntake({ applicationLogs: 'a\nb\nc' }),
      [],
    );
    expect(new Set(evidence.map((item) => item.id)).size).toBe(evidence.length);
  });
});
