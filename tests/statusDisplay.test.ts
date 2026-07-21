import { describe, expect, it } from 'vitest';
import {
  getIncidentStatusDisplay,
  getReviewStatusDisplay,
  getSeverityDisplay,
} from '../src/utils/statusDisplay';

describe('getSeverityDisplay', () => {
  it('gives critical severity an error color', () => {
    expect(getSeverityDisplay('critical')).toEqual({ label: 'Critical', color: 'error' });
  });

  it('gives every severity a non-empty text label', () => {
    for (const severity of ['low', 'medium', 'high', 'critical'] as const) {
      expect(getSeverityDisplay(severity).label.length).toBeGreaterThan(0);
    }
  });
});

describe('getIncidentStatusDisplay', () => {
  it('gives resolved a success color', () => {
    expect(getIncidentStatusDisplay('resolved').color).toBe('success');
  });

  it('gives every status a non-empty text label', () => {
    for (const status of [
      'draft',
      'analyzing',
      'under-investigation',
      'resolved',
      'archived',
    ] as const) {
      expect(getIncidentStatusDisplay(status).label.length).toBeGreaterThan(0);
    }
  });
});

describe('getReviewStatusDisplay', () => {
  it('gives supported a success color (per the app-wide "green = human-reviewed supported" rule)', () => {
    expect(getReviewStatusDisplay('supported').color).toBe('success');
  });

  it('never uses success for an unreviewed statement', () => {
    expect(getReviewStatusDisplay('unreviewed').color).not.toBe('success');
  });

  it('gives every review status a non-empty text label', () => {
    for (const status of [
      'unreviewed',
      'supported',
      'partially-supported',
      'unsupported',
      'rejected',
    ] as const) {
      expect(getReviewStatusDisplay(status).label.length).toBeGreaterThan(0);
    }
  });
});
