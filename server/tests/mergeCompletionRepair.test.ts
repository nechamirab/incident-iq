import { describe, expect, it } from 'vitest';
import { mergeCompletionRepair } from '../src/ai/mergeCompletionRepair.js';
import { buildValidAiResponse } from './helpers/aiResponseFixtures.js';

describe('mergeCompletionRepair', () => {
  it('adopts a non-empty repaired reasoningRisks when it was the targeted deficiency', () => {
    const original = buildValidAiResponse({ reasoningRisks: [] });
    const repaired = buildValidAiResponse({
      reasoningRisks: [
        {
          biasType: 'anchoring-bias',
          title: 'Early evidence anchored the investigation',
          description: 'x',
          detectedIn: 'timeline',
          evidenceIds: ['evidence-1'],
          riskLevel: 'medium',
          mitigation: 'x',
        },
      ],
    });

    const result = mergeCompletionRepair(original, repaired, ['empty-reasoning-risks']);
    expect(result.response.reasoningRisks).toHaveLength(1);
    expect(result.repairedSections).toEqual(['reasoningRisks']);
  });

  it('does not adopt a repaired section that was not targeted, even if different', () => {
    const original = buildValidAiResponse({ recommendedActions: [] });
    const repaired = buildValidAiResponse(); // has reasoningRisks + recommendedActions populated

    const result = mergeCompletionRepair(original, repaired, ['empty-reasoning-risks']);
    // reasoningRisks WAS targeted and original already had one (non-empty by
    // default fixture), so nothing to adopt there either -- but critically,
    // the untargeted recommendedActions must stay empty (from `original`),
    // not silently pulled in from `repaired`.
    expect(result.response.recommendedActions).toEqual([]);
    expect(result.repairedSections).not.toContain('recommendedActions');
  });

  it('never adopts facts or summary from the repaired response, even when other sections are merged', () => {
    const original = buildValidAiResponse({ reasoningRisks: [] });
    const repaired = buildValidAiResponse({
      facts: [{ statement: 'A completely different fact.', explanation: 'x', evidenceIds: ['evidence-1'], confidence: 90 }],
      summary: { text: 'A completely different summary.', affectedComponents: [], impact: 'x' },
      reasoningRisks: [
        {
          biasType: 'automation-bias',
          title: 'x',
          description: 'x',
          detectedIn: 'overall-analysis',
          evidenceIds: [],
          riskLevel: 'low',
          mitigation: 'x',
        },
      ],
    });

    const result = mergeCompletionRepair(original, repaired, ['empty-reasoning-risks']);
    expect(result.response.facts).toEqual(original.facts);
    expect(result.response.summary).toEqual(original.summary);
    expect(result.response.reasoningRisks).toEqual(repaired.reasoningRisks);
  });

  it('leaves a section untouched if the repair attempt did not actually improve it', () => {
    const original = buildValidAiResponse({ recommendedActions: [] });
    const repaired = buildValidAiResponse({ recommendedActions: [] }); // still empty after repair

    const result = mergeCompletionRepair(original, repaired, ['empty-recommended-actions']);
    expect(result.response.recommendedActions).toEqual([]);
    expect(result.repairedSections).toEqual([]);
  });

  it('adopts repaired hypotheses only when the tempId shape matches and contradicting evidence was actually added', () => {
    const original = buildValidAiResponse();
    original.hypotheses.forEach((h) => (h.contradictingEvidenceIds = []));

    const repaired = buildValidAiResponse();
    repaired.hypotheses[0].contradictingEvidenceIds = ['evidence-1'];

    const result = mergeCompletionRepair(original, repaired, [
      'all-hypotheses-missing-contradicting-evidence',
    ]);
    expect(result.response.hypotheses[0].contradictingEvidenceIds).toEqual(['evidence-1']);
    expect(result.repairedSections).toContain('hypotheses');
  });

  it('rejects repaired hypotheses whose tempIds do not match the original set', () => {
    const original = buildValidAiResponse();
    original.hypotheses.forEach((h) => (h.contradictingEvidenceIds = []));

    const repaired = buildValidAiResponse();
    repaired.hypotheses = [{ ...repaired.hypotheses[0], tempId: 'DIFFERENT-ID', contradictingEvidenceIds: ['evidence-1'] }];

    const result = mergeCompletionRepair(original, repaired, [
      'all-hypotheses-missing-contradicting-evidence',
    ]);
    expect(result.response.hypotheses).toEqual(original.hypotheses);
    expect(result.repairedSections).not.toContain('hypotheses');
  });
});
