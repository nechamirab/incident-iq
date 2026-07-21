import { describe, expect, it } from 'vitest';
import {
  getActionCategoryLabel,
  getActionPriorityDisplay,
  getActionStatusDisplay,
  getBiasTypeLabel,
  getHypothesisStatusDisplay,
  getIncidentStatusDisplay,
  getReviewStatusDisplay,
  getRiskLevelDisplay,
  getSeverityDisplay,
  getTimestampTypeDisplay,
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

describe('getHypothesisStatusDisplay', () => {
  it('gives a success color to both supported and confirmed-by-human, with distinct labels', () => {
    expect(getHypothesisStatusDisplay('supported').color).toBe('success');
    expect(getHypothesisStatusDisplay('confirmed-by-human').color).toBe('success');
    expect(getHypothesisStatusDisplay('supported').label).not.toBe(
      getHypothesisStatusDisplay('confirmed-by-human').label,
    );
  });

  it('gives every status a non-empty text label', () => {
    for (const status of [
      'proposed',
      'testing',
      'supported',
      'weakened',
      'rejected',
      'confirmed-by-human',
    ] as const) {
      expect(getHypothesisStatusDisplay(status).label.length).toBeGreaterThan(0);
    }
  });
});

describe('getTimestampTypeDisplay', () => {
  it('gives every timestamp type a non-empty text label', () => {
    for (const type of ['exact', 'approximate', 'inferred', 'unknown'] as const) {
      expect(getTimestampTypeDisplay(type).label.length).toBeGreaterThan(0);
    }
  });

  it('distinguishes inferred from exact with a different color', () => {
    expect(getTimestampTypeDisplay('inferred').color).not.toBe(
      getTimestampTypeDisplay('exact').color,
    );
  });
});

describe('getBiasTypeLabel', () => {
  it('gives every bias type a distinct, non-empty label', () => {
    const types = [
      'confirmation-bias',
      'anchoring-bias',
      'automation-bias',
      'post-hoc-fallacy',
      'availability-bias',
      'overconfidence-bias',
      'hindsight-bias',
      'base-rate-neglect',
    ] as const;
    const labels = types.map(getBiasTypeLabel);
    expect(labels.every((label) => label.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(types.length);
  });
});

describe('getRiskLevelDisplay', () => {
  it('gives high risk an error color and low risk a non-error color', () => {
    expect(getRiskLevelDisplay('high').color).toBe('error');
    expect(getRiskLevelDisplay('low').color).not.toBe('error');
  });

  it('gives every risk level a non-empty text label', () => {
    for (const level of ['low', 'medium', 'high'] as const) {
      expect(getRiskLevelDisplay(level).label.length).toBeGreaterThan(0);
    }
  });
});

describe('getActionPriorityDisplay', () => {
  it('gives immediate priority an error color', () => {
    expect(getActionPriorityDisplay('immediate').color).toBe('error');
  });

  it('gives every priority a non-empty text label', () => {
    for (const priority of ['immediate', 'high', 'medium', 'low'] as const) {
      expect(getActionPriorityDisplay(priority).label.length).toBeGreaterThan(0);
    }
  });
});

describe('getActionCategoryLabel', () => {
  it('gives every category a non-empty label', () => {
    const categories = [
      'inspect',
      'reproduce',
      'compare',
      'rollback',
      'monitor',
      'communicate',
      'collect-evidence',
      'configuration-check',
      'code-review',
      'database-check',
    ] as const;
    for (const category of categories) {
      expect(getActionCategoryLabel(category).length).toBeGreaterThan(0);
    }
  });
});

describe('getActionStatusDisplay', () => {
  it('gives completed a success color', () => {
    expect(getActionStatusDisplay('completed').color).toBe('success');
  });

  it('gives every status a non-empty text label', () => {
    for (const status of ['suggested', 'in-progress', 'completed', 'dismissed'] as const) {
      expect(getActionStatusDisplay(status).label.length).toBeGreaterThan(0);
    }
  });
});
