import { describe, expect, it } from 'vitest';
import { IncidentIntakeRequestSchema } from '../src/schemas/incidentIntake.schema.js';

function buildValidBody(): Record<string, string> {
  return {
    title: 'Checkout failures',
    description: 'Customers cannot complete checkout.',
    severity: 'critical',
    affectedService: 'checkout-api',
    detectedAt: '2026-07-01T00:00:00Z',
  };
}

describe('IncidentIntakeRequestSchema', () => {
  it('accepts a minimal valid submission', () => {
    expect(IncidentIntakeRequestSchema.safeParse(buildValidBody()).success).toBe(true);
  });

  it('accepts a submission with every optional evidence field filled in', () => {
    const result = IncidentIntakeRequestSchema.safeParse({
      ...buildValidBody(),
      startedAt: '2026-06-30T23:50:00Z',
      applicationLogs: 'log line',
      errorTraces: 'trace line',
      monitoringAlerts: 'alert line',
      deploymentNotes: 'deploy note',
      userComplaints: 'complaint',
      apiErrors: 'api error',
      databaseErrors: 'db error',
      scenarioType: 'custom',
    });
    expect(result.success).toBe(true);
  });

  it.each(['title', 'description', 'severity', 'affectedService', 'detectedAt'])(
    'rejects a submission missing required field "%s"',
    (field) => {
      const body = buildValidBody();
      delete body[field];
      expect(IncidentIntakeRequestSchema.safeParse(body).success).toBe(false);
    },
  );

  it('rejects an invalid severity value', () => {
    const result = IncidentIntakeRequestSchema.safeParse({
      ...buildValidBody(),
      severity: 'catastrophic',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO detectedAt value', () => {
    const result = IncidentIntakeRequestSchema.safeParse({
      ...buildValidBody(),
      detectedAt: 'not a date',
    });
    expect(result.success).toBe(false);
  });
});
