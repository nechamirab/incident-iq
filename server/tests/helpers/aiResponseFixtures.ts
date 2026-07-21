import type { AiAnalysisResponse } from '../../src/ai/schemas/aiAnalysisResponse.schema.js';

/**
 * Builds a minimal, schema-valid {@link AiAnalysisResponse}. Tests override
 * only the fields they care about via `overrides`.
 */
export function buildValidAiResponse(
  overrides: Partial<AiAnalysisResponse> = {},
  evidenceId = 'evidence-1',
): AiAnalysisResponse {
  return {
    summary: {
      text: 'A test summary.',
      affectedComponents: ['test-service'],
      impact: 'Unknown impact.',
    },
    timeline: [],
    facts: [
      {
        statement: 'Something happened.',
        explanation: 'Observed directly.',
        evidenceIds: [evidenceId],
        confidence: 80,
      },
    ],
    assumptions: [],
    hypotheses: [
      {
        tempId: 'H1',
        title: 'Hypothesis one',
        description: 'First candidate explanation.',
        confidence: 50,
        confidenceReason: 'Some evidence supports it.',
        supportingEvidenceIds: [evidenceId],
        contradictingEvidenceIds: [],
        assumptions: [],
        recommendedTest: 'Do a specific test.',
        expectedResult: 'A specific expected result.',
      },
      {
        tempId: 'H2',
        title: 'Hypothesis two',
        description: 'Second candidate explanation.',
        confidence: 30,
        confidenceReason: 'Less evidence supports it.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [evidenceId],
        assumptions: [],
        recommendedTest: 'Do another test.',
        expectedResult: 'Another expected result.',
      },
      {
        tempId: 'H3',
        title: 'Hypothesis three',
        description: 'Third candidate explanation.',
        confidence: 20,
        confidenceReason: 'Little evidence either way.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        assumptions: [],
        recommendedTest: 'Do a third test.',
        expectedResult: 'A third expected result.',
      },
    ],
    reasoningRisks: [],
    recommendedActions: [
      {
        title: 'Investigate further',
        description: 'A specific investigation step.',
        priority: 'high',
        category: 'inspect',
        relatedHypothesisIds: ['H1'],
        evidenceIds: [evidenceId],
        expectedOutcome: 'Confirms or rules out hypothesis one.',
        risk: 'Low.',
      },
    ],
    openQuestions: ['Has this been reviewed by a human?'],
    unsupportedClaims: [],
    uncertaintyStatement: 'This analysis has known limitations.',
    ...overrides,
  };
}
