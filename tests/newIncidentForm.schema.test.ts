import { describe, expect, it } from 'vitest';
import { NewIncidentFormSchema } from '../src/schemas/newIncidentForm.schema';

function buildValid(): Record<string, string> {
  return {
    title: 'Checkout failures',
    description: 'Customers cannot complete checkout.',
    severity: 'critical',
    affectedService: 'checkout-api',
    startedAt: '',
    detectedAt: '2026-06-14T14:41',
    applicationLogs: '',
    errorTraces: '',
    monitoringAlerts: '',
    deploymentNotes: '',
    userComplaints: '',
    apiErrors: '',
    databaseErrors: '',
    scenarioType: 'custom',
  };
}

describe('NewIncidentFormSchema', () => {
  it('accepts a minimal valid submission', () => {
    expect(NewIncidentFormSchema.safeParse(buildValid()).success).toBe(true);
  });

  it('accepts a submission with a valid startedAt', () => {
    const result = NewIncidentFormSchema.safeParse({
      ...buildValid(),
      startedAt: '2026-06-14T14:30',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a blank title', () => {
    const result = NewIncidentFormSchema.safeParse({ ...buildValid(), title: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects a blank description', () => {
    const result = NewIncidentFormSchema.safeParse({ ...buildValid(), description: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a blank affected service', () => {
    const result = NewIncidentFormSchema.safeParse({ ...buildValid(), affectedService: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid severity', () => {
    const result = NewIncidentFormSchema.safeParse({ ...buildValid(), severity: 'catastrophic' });
    expect(result.success).toBe(false);
  });

  it('rejects a blank detection time', () => {
    const result = NewIncidentFormSchema.safeParse({ ...buildValid(), detectedAt: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an unparseable detection time', () => {
    const result = NewIncidentFormSchema.safeParse({ ...buildValid(), detectedAt: 'not a date' });
    expect(result.success).toBe(false);
  });

  it('rejects an unparseable start time when non-empty', () => {
    const result = NewIncidentFormSchema.safeParse({ ...buildValid(), startedAt: 'not a date' });
    expect(result.success).toBe(false);
  });
});
