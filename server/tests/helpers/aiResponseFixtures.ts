import type { AiAnalysisResponse } from '../../src/ai/schemas/aiAnalysisResponse.schema.js';
import type { AiPostmortemResponse } from '../../src/ai/schemas/postmortemResponse.schema.js';
import type { AiSkepticReviewResponse } from '../../src/ai/schemas/skepticReviewResponse.schema.js';

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
    reasoningRisks: [
      {
        biasType: 'confirmation-bias',
        title: 'Leading hypothesis lacks contradicting evidence',
        description: 'No evidence weighing against hypothesis one was identified.',
        detectedIn: 'hypotheses',
        evidenceIds: [],
        riskLevel: 'medium',
        mitigation: 'Actively search for evidence that would weaken hypothesis one.',
      },
    ],
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

/**
 * Builds a minimal, schema-valid {@link AiSkepticReviewResponse}. Tests
 * override only the fields they care about via `overrides`.
 */
export function buildValidSkepticReviewResponse(
  overrides: Partial<AiSkepticReviewResponse> = {},
): AiSkepticReviewResponse {
  return {
    challengeSummary: 'The leading hypothesis rests on a narrow slice of evidence.',
    alternativeExplanations: ['Hypothesis two was not fully explored.'],
    confirmationBiasAssessment: 'No contradicting evidence was actively sought.',
    falsificationTest: 'If the pattern also appears during a known-healthy period, this is falsified.',
    recommendedTests: ['Independently verify the supporting evidence.'],
    overallAssessment: 'This does not confirm or reject the leading hypothesis.',
    ...overrides,
  };
}

/**
 * Builds a minimal, schema-valid {@link AiPostmortemResponse}. Tests
 * override only the fields they care about via `overrides`.
 */
export function buildValidPostmortemResponse(
  overrides: Partial<AiPostmortemResponse> = {},
): AiPostmortemResponse {
  return {
    incidentSummary: 'Checkout failures following a deployment.',
    impact: 'Customers could not complete checkout for roughly 40 minutes.',
    detection: 'Detected via a monitoring alert.',
    timeline: '3 events were reconstructed.',
    contributingFactors: ['Reduced DB connection pool size.'],
    hypothesesInvestigated: ['Connection pool exhaustion -- confidence 50/100, status: proposed.'],
    likelyCause: 'The available evidence suggests connection pool exhaustion.',
    uncertaintyStatement: 'This has not been independently confirmed.',
    resolution: 'This incident has not yet been marked resolved.',
    correctiveActions: ['Add a load test gate for pool-affecting config changes.'],
    lessonsLearned: ['Config changes affecting infrastructure need the same review as code.'],
    followUpItems: ['Has this been reviewed by a human?'],
    ...overrides,
  };
}
