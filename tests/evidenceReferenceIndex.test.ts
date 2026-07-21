import { describe, expect, it } from 'vitest';
import {
  buildEvidenceReferenceIndex,
  summarizeEvidenceReferences,
} from '../src/utils/evidenceReferenceIndex';
import { buildAnalysisRun } from './helpers/analysisRunFixture';

describe('buildEvidenceReferenceIndex', () => {
  it('indexes a fact by the evidence it cites', () => {
    const run = buildAnalysisRun({
      facts: [
        {
          id: 'fact-1',
          category: 'fact',
          statement: 'checkout-api returned 500 errors.',
          explanation: 'x',
          evidenceIds: ['ev-1'],
          confidence: 80,
          reviewStatus: 'unreviewed',
        },
      ],
    });

    const index = buildEvidenceReferenceIndex(run);
    expect(index.get('ev-1')).toEqual([{ type: 'fact', label: 'Fact #1' }]);
  });

  it('indexes a hypothesis under both supporting and contradicting evidence', () => {
    const run = buildAnalysisRun({
      hypotheses: [
        {
          id: 'hyp-1',
          title: 'Connection pool exhaustion',
          description: 'x',
          confidence: 60,
          confidenceReason: 'x',
          supportingEvidenceIds: ['ev-1'],
          contradictingEvidenceIds: ['ev-2'],
          assumptions: [],
          recommendedTest: 'x',
          expectedResult: 'x',
          status: 'proposed',
        },
      ],
    });

    const index = buildEvidenceReferenceIndex(run);
    expect(index.get('ev-1')).toEqual([
      { type: 'hypothesis', label: 'Connection pool exhaustion (supporting)' },
    ]);
    expect(index.get('ev-2')).toEqual([
      { type: 'hypothesis', label: 'Connection pool exhaustion (contradicting)' },
    ]);
  });

  it('accumulates multiple references to the same evidence id', () => {
    const run = buildAnalysisRun({
      facts: [
        {
          id: 'fact-1',
          category: 'fact',
          statement: 'a',
          explanation: 'x',
          evidenceIds: ['ev-1'],
          confidence: 80,
          reviewStatus: 'unreviewed',
        },
      ],
      assumptions: [
        {
          id: 'assumption-1',
          category: 'assumption',
          statement: 'b',
          explanation: 'x',
          evidenceIds: ['ev-1'],
          confidence: 30,
          reviewStatus: 'unreviewed',
        },
      ],
    });

    const index = buildEvidenceReferenceIndex(run);
    expect(index.get('ev-1')).toHaveLength(2);
  });

  it('returns an empty index for an evidence id with no citations', () => {
    const run = buildAnalysisRun();
    expect(buildEvidenceReferenceIndex(run).get('ev-uncited')).toBeUndefined();
  });
});

describe('summarizeEvidenceReferences', () => {
  it('formats a single reference in singular form', () => {
    expect(summarizeEvidenceReferences([{ type: 'fact', label: 'Fact #1' }])).toBe('1 fact');
  });

  it('formats multiple references of the same type in plural form', () => {
    expect(
      summarizeEvidenceReferences([
        { type: 'fact', label: 'Fact #1' },
        { type: 'fact', label: 'Fact #2' },
      ]),
    ).toBe('2 facts');
  });

  it('formats references of different types together', () => {
    const summary = summarizeEvidenceReferences([
      { type: 'fact', label: 'Fact #1' },
      { type: 'hypothesis', label: 'H1 (supporting)' },
    ]);
    expect(summary).toContain('1 fact');
    expect(summary).toContain('1 hypothesis');
  });
});
