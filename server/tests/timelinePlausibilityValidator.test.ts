import { describe, expect, it } from 'vitest';
import { validateTimelinePlausibility } from '../src/ai/validators/timelinePlausibilityValidator.js';
import type { AiTimelineEvent } from '../src/ai/schemas/aiAnalysisResponse.schema.js';

const INCIDENT = { startedAt: '2026-06-14T14:30:00Z', detectedAt: '2026-06-14T14:41:00Z' };

function buildEvent(overrides: Partial<AiTimelineEvent> = {}): AiTimelineEvent {
  return {
    timestamp: '2026-06-14T14:33:00Z',
    title: 'Something happened',
    description: 'x',
    evidenceIds: [],
    timestampType: 'exact',
    confidence: 90,
    isInferred: false,
    ...overrides,
  };
}

describe('validateTimelinePlausibility', () => {
  it('produces no warnings for an event inside the incident window', () => {
    expect(validateTimelinePlausibility([buildEvent()], INCIDENT)).toEqual([]);
  });

  it('does not flag legitimate deployment/historical evidence a few hours before startedAt', () => {
    const event = buildEvent({ timestamp: '2026-06-14T10:00:00Z' }); // 4.5 hours before startedAt
    expect(validateTimelinePlausibility([event], INCIDENT)).toEqual([]);
  });

  it('does not flag evidence up to ~30 days before startedAt (generous window)', () => {
    const event = buildEvent({ timestamp: '2026-05-20T00:00:00Z' }); // ~25 days before
    expect(validateTimelinePlausibility([event], INCIDENT)).toEqual([]);
  });

  it('flags an unparseable timestamp', () => {
    const event = buildEvent({ timestamp: 'sometime last week' });
    const warnings = validateTimelinePlausibility([event], INCIDENT);
    expect(warnings.some((w) => w.includes('unparseable'))).toBe(true);
  });

  it('flags a timestamp in the future', () => {
    const event = buildEvent({ timestamp: '2099-01-01T00:00:00Z' });
    const warnings = validateTimelinePlausibility([event], INCIDENT);
    expect(warnings.some((w) => w.includes('future'))).toBe(true);
  });

  it('flags a timestamp far outside the incident window (e.g. a year before)', () => {
    const event = buildEvent({ timestamp: '2025-01-01T00:00:00Z' });
    const warnings = validateTimelinePlausibility([event], INCIDENT);
    expect(warnings.some((w) => w.includes('far outside'))).toBe(true);
  });

  it('flags timestampType "exact" combined with isInferred true as contradictory', () => {
    const event = buildEvent({ timestampType: 'exact', isInferred: true });
    const warnings = validateTimelinePlausibility([event], INCIDENT);
    expect(warnings.some((w) => w.includes('contradictory') || w.includes('isInferred is true'))).toBe(true);
  });

  it('flags timestampType "inferred" combined with isInferred false as inconsistent', () => {
    const event = buildEvent({ timestampType: 'inferred', isInferred: false });
    const warnings = validateTimelinePlausibility([event], INCIDENT);
    expect(warnings.some((w) => w.includes('should agree'))).toBe(true);
  });

  it('does not flag timestampType "approximate" or "unknown" against isInferred either way', () => {
    const approx = buildEvent({ timestampType: 'approximate', isInferred: true });
    const unknown = buildEvent({ timestampType: 'unknown', isInferred: false });
    expect(validateTimelinePlausibility([approx], INCIDENT)).toEqual([]);
    expect(validateTimelinePlausibility([unknown], INCIDENT)).toEqual([]);
  });

  it('never throws for an empty events array', () => {
    expect(() => validateTimelinePlausibility([], INCIDENT)).not.toThrow();
    expect(validateTimelinePlausibility([], INCIDENT)).toEqual([]);
  });

  it('handles a missing startedAt by falling back to a window around detectedAt', () => {
    const event = buildEvent({ timestamp: '2026-06-14T14:35:00Z' });
    const warnings = validateTimelinePlausibility([event], { startedAt: null, detectedAt: INCIDENT.detectedAt });
    expect(warnings).toEqual([]);
  });
});
