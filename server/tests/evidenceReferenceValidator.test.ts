import { describe, expect, it } from 'vitest';
import { findUnknownEvidenceReferences } from '../src/ai/validators/evidenceReferenceValidator.js';
import { buildValidAiResponse } from './helpers/aiResponseFixtures.js';

describe('findUnknownEvidenceReferences', () => {
  it('returns no warnings when every reference is known', () => {
    const response = buildValidAiResponse({}, 'evidence-1');
    const warnings = findUnknownEvidenceReferences(response, new Set(['evidence-1']));
    expect(warnings).toEqual([]);
  });

  it('flags an unknown evidence id cited by a fact', () => {
    const response = buildValidAiResponse({}, 'evidence-999');
    const warnings = findUnknownEvidenceReferences(response, new Set(['evidence-1']));
    expect(warnings.some((w) => w.includes('Fact #1') && w.includes('evidence-999'))).toBe(true);
  });

  it('flags an unknown evidence id cited by a hypothesis', () => {
    const response = buildValidAiResponse();
    response.hypotheses[0].supportingEvidenceIds = ['bogus-id'];
    const warnings = findUnknownEvidenceReferences(response, new Set(['evidence-1']));
    expect(warnings.some((w) => w.includes('Hypothesis "H1"') && w.includes('bogus-id'))).toBe(true);
  });

  it('flags an unknown evidence id cited by a recommended action', () => {
    const response = buildValidAiResponse();
    response.recommendedActions[0].evidenceIds = ['bogus-id'];
    const warnings = findUnknownEvidenceReferences(response, new Set(['evidence-1']));
    expect(warnings.some((w) => w.includes('Recommended action #1') && w.includes('bogus-id'))).toBe(
      true,
    );
  });

  it('flags an unknown evidence id cited by a timeline event', () => {
    const response = buildValidAiResponse({
      timeline: [
        {
          timestamp: '2026-01-01T00:00:00Z',
          title: 'Something occurred',
          description: 'desc',
          evidenceIds: ['bogus-id'],
          timestampType: 'exact',
          confidence: 90,
          isInferred: false,
        },
      ],
    });
    const warnings = findUnknownEvidenceReferences(response, new Set(['evidence-1']));
    expect(warnings.some((w) => w.includes('Timeline event #1') && w.includes('bogus-id'))).toBe(true);
  });
});
