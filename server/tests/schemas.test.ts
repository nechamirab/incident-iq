import { describe, expect, it } from 'vitest';
import {
  ActionPrioritySchema,
  AnalysisRunSchema,
  BiasFindingSchema,
  ConfidenceScoreSchema,
  EvidenceItemSchema,
  HypothesisSchema,
  IncidentSchema,
  PostmortemSchema,
  RecommendedActionSchema,
  ReasoningItemSchema,
  SkepticReviewSchema,
  TimelineEventSchema,
  UserSelectableIncidentStatusSchema,
} from '../../shared/schemas/index.js';
import { sampleIncidents } from '../src/data/incidents/index.js';

describe('ConfidenceScoreSchema', () => {
  it('accepts integers between 0 and 100', () => {
    expect(ConfidenceScoreSchema.safeParse(0).success).toBe(true);
    expect(ConfidenceScoreSchema.safeParse(100).success).toBe(true);
    expect(ConfidenceScoreSchema.safeParse(55).success).toBe(true);
  });

  it('rejects values outside 0-100 and non-integers', () => {
    expect(ConfidenceScoreSchema.safeParse(-1).success).toBe(false);
    expect(ConfidenceScoreSchema.safeParse(101).success).toBe(false);
    expect(ConfidenceScoreSchema.safeParse(50.5).success).toBe(false);
  });
});

describe('IncidentSchema', () => {
  it('accepts every bundled sample incident', () => {
    for (const incident of sampleIncidents) {
      const result = IncidentSchema.safeParse(incident);
      expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
        true,
      );
    }
  });

  it('rejects an incident with an invalid severity', () => {
    const invalid = { ...sampleIncidents[0], severity: 'catastrophic' };
    expect(IncidentSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects an incident missing a required field', () => {
    const { title: _title, ...withoutTitle } = sampleIncidents[0];
    expect(IncidentSchema.safeParse(withoutTitle).success).toBe(false);
  });

  it('accepts a null resolutionNotes', () => {
    const incident = { ...sampleIncidents[0], resolutionNotes: null };
    expect(IncidentSchema.safeParse(incident).success).toBe(true);
  });

  it('accepts a populated resolutionNotes string', () => {
    const incident = { ...sampleIncidents[0], resolutionNotes: 'Root cause addressed.' };
    expect(IncidentSchema.safeParse(incident).success).toBe(true);
  });
});

describe('UserSelectableIncidentStatusSchema', () => {
  it('accepts every user-selectable status', () => {
    for (const status of ['draft', 'under-investigation', 'resolved', 'archived']) {
      expect(UserSelectableIncidentStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('excludes "analyzing", a system-managed transient status', () => {
    expect(UserSelectableIncidentStatusSchema.safeParse('analyzing').success).toBe(false);
  });

  it('rejects an unsupported status value', () => {
    expect(UserSelectableIncidentStatusSchema.safeParse('closed').success).toBe(false);
  });
});

describe('EvidenceItemSchema', () => {
  it('accepts every evidence item across all sample incidents', () => {
    for (const incident of sampleIncidents) {
      for (const evidence of incident.evidence) {
        const result = EvidenceItemSchema.safeParse(evidence);
        expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
          true,
        );
      }
    }
  });

  it('rejects an evidence item with an invalid sourceType', () => {
    const invalid = { ...sampleIncidents[0].evidence[0], sourceType: 'carrier-pigeon' };
    expect(EvidenceItemSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('ReasoningItemSchema', () => {
  const valid = {
    id: 'ri-1',
    category: 'fact',
    statement: 'checkout-api returned 500 errors starting at 14:33 UTC.',
    explanation: 'Directly observed in checkout-api-error.log.',
    evidenceIds: ['sample-ecommerce-checkout-ev-03'],
    confidence: 90,
    reviewStatus: 'unreviewed',
  };

  it('accepts a well-formed reasoning item', () => {
    expect(ReasoningItemSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid category', () => {
    expect(ReasoningItemSchema.safeParse({ ...valid, category: 'opinion' }).success).toBe(false);
  });
});

describe('TimelineEventSchema', () => {
  const valid = {
    id: 'tl-1',
    timestamp: '2026-06-14T14:28:00Z',
    title: 'checkout-api v2.4.1 deployed',
    description: 'Deployment completed, reducing the DB connection pool size.',
    evidenceIds: ['sample-ecommerce-checkout-ev-02'],
    timestampType: 'exact',
    confidence: 95,
    isInferred: false,
  };

  it('accepts a well-formed timeline event', () => {
    expect(TimelineEventSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid timestampType', () => {
    expect(TimelineEventSchema.safeParse({ ...valid, timestampType: 'guessed' }).success).toBe(
      false,
    );
  });
});

describe('HypothesisSchema', () => {
  const valid = {
    id: 'hyp-1',
    title: 'Connection pool exhaustion from the v2.4.1 deploy',
    description: 'The reduced pool size could not absorb normal peak load.',
    confidence: 65,
    confidenceReason: 'Strong timing correlation, but a successful request post-deploy weakens it.',
    supportingEvidenceIds: ['sample-ecommerce-checkout-ev-02', 'sample-ecommerce-checkout-ev-04'],
    contradictingEvidenceIds: ['sample-ecommerce-checkout-ev-09'],
    assumptions: ['No other configuration changed at the same time.'],
    recommendedTest: 'Revert the pool size only, on a canary pod, and observe timeout rates.',
    expectedResult: 'Timeout rate returns to baseline if this is the cause.',
    status: 'proposed',
  };

  it('accepts a well-formed hypothesis', () => {
    expect(HypothesisSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a hypothesis with confidence out of range', () => {
    expect(HypothesisSchema.safeParse({ ...valid, confidence: 150 }).success).toBe(false);
  });

  it('accepts every defined hypothesis status', () => {
    const statuses = [
      'proposed',
      'testing',
      'supported',
      'weakened',
      'rejected',
      'confirmed-by-human',
    ];
    for (const status of statuses) {
      expect(HypothesisSchema.safeParse({ ...valid, status }).success).toBe(true);
    }
  });
});

describe('BiasFindingSchema', () => {
  const valid = {
    id: 'bias-1',
    biasType: 'anchoring-bias',
    title: 'Early Redis cache warning may anchor the investigation',
    description:
      'The cache warning at 14:20 UTC precedes the incident and is unrelated to checkout-api.',
    detectedIn: 'hypotheses',
    evidenceIds: ['sample-ecommerce-checkout-ev-10'],
    riskLevel: 'medium',
    mitigation: 'Explicitly test whether the cache warning correlates with checkout failures.',
  };

  it('accepts a well-formed bias finding', () => {
    expect(BiasFindingSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid biasType', () => {
    expect(BiasFindingSchema.safeParse({ ...valid, biasType: 'gut-feeling' }).success).toBe(false);
  });
});

describe('RecommendedActionSchema', () => {
  const valid = {
    id: 'act-1',
    title: 'Compare DB connection-pool utilization before and after v2.4.1',
    description:
      'Pull connection-pool utilization for checkout-api for the 15 minutes before and after ' +
      '14:28 UTC.',
    priority: 'immediate',
    category: 'compare',
    relatedHypothesisIds: ['hyp-1'],
    evidenceIds: ['sample-ecommerce-checkout-ev-04'],
    expectedOutcome: 'Confirms or rules out pool exhaustion as a contributing factor.',
    risk: 'None; read-only metrics query.',
    status: 'suggested',
  };

  it('accepts a well-formed recommended action', () => {
    expect(RecommendedActionSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts every defined priority', () => {
    for (const priority of ActionPrioritySchema.options) {
      expect(RecommendedActionSchema.safeParse({ ...valid, priority }).success).toBe(true);
    }
  });
});

describe('AnalysisRunSchema', () => {
  const valid = {
    id: 'run-1',
    incidentId: 'sample-ecommerce-checkout',
    provider: 'mock',
    model: 'mock-v1',
    promptVersion: 'incident-analysis-v1',
    createdAt: '2026-06-14T15:00:00Z',
    inputHash: 'abc123',
    durationMs: 1200,
    status: 'completed',
    summary: {
      text: 'Checkout failures began shortly after a deploy that reduced DB pool size.',
      affectedComponents: ['checkout-api', 'postgres-primary'],
      impact: 'Customers were unable to complete checkout for roughly 40 minutes.',
    },
    timeline: [],
    facts: [],
    assumptions: [],
    hypotheses: [],
    reasoningRisks: [],
    recommendedActions: [],
    openQuestions: ['Was the connection pool change reviewed before deployment?'],
    unsupportedClaims: [],
    uncertaintyStatement: 'The contribution of elevated Stripe latency has not been ruled out.',
    validationWarnings: [],
    rawResponse: { note: 'mock provider does not produce a raw response' },
  };

  it('accepts a well-formed analysis run', () => {
    const result = AnalysisRunSchema.safeParse(valid);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
  });

  it('rejects an invalid provider', () => {
    expect(AnalysisRunSchema.safeParse({ ...valid, provider: 'azure-openai' }).success).toBe(false);
  });

  it('accepts "openai" as a valid provider', () => {
    expect(AnalysisRunSchema.safeParse({ ...valid, provider: 'openai' }).success).toBe(true);
  });
});

describe('SkepticReviewSchema', () => {
  const valid = {
    id: 'review-1',
    incidentId: 'sample-ecommerce-checkout',
    analysisRunId: 'run-1',
    provider: 'mock',
    model: 'mock-v1',
    promptVersion: 'skeptic-review-v1',
    createdAt: '2026-06-14T15:05:00Z',
    durationMs: 400,
    challengedHypothesisId: 'hyp-1',
    challengeSummary: 'The leading hypothesis relies on a narrow slice of evidence.',
    alternativeExplanations: ['Hypothesis two was not fully explored.'],
    ignoredEvidenceIds: ['sample-ecommerce-checkout-ev-10'],
    confirmationBiasAssessment: 'No contradicting evidence was actively sought.',
    falsificationTest: 'If the pattern also appears in a known-healthy period, this is falsified.',
    recommendedTests: ['Independently verify the supporting evidence.'],
    overallAssessment: 'This does not confirm or reject the leading hypothesis.',
    humanNotes: null,
    rawResponse: { note: 'mock provider does not produce a raw response' },
  };

  it('accepts a well-formed skeptic review', () => {
    const result = SkepticReviewSchema.safeParse(valid);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
  });

  it('accepts a non-null humanNotes string', () => {
    expect(SkepticReviewSchema.safeParse({ ...valid, humanNotes: 'Reviewed.' }).success).toBe(true);
  });

  it('rejects an invalid provider', () => {
    expect(SkepticReviewSchema.safeParse({ ...valid, provider: 'azure-openai' }).success).toBe(false);
  });

  it('rejects an empty challengeSummary', () => {
    expect(SkepticReviewSchema.safeParse({ ...valid, challengeSummary: '' }).success).toBe(false);
  });
});

describe('PostmortemSchema', () => {
  it('accepts a well-formed postmortem', () => {
    const valid = {
      incidentSummary: 'Checkout failures following the v2.4.1 deployment.',
      impact: 'Customers could not complete checkout for approximately 40 minutes.',
      detection: 'Detected via Datadog error-rate alert and customer support tickets.',
      timeline: 'See incident timeline.',
      contributingFactors: ['Reduced DB connection pool size in v2.4.1'],
      hypothesesInvestigated: ['Connection pool exhaustion', 'Third-party payment latency'],
      likelyCause: 'The available evidence suggests connection pool exhaustion was the primary factor.',
      uncertaintyStatement: 'The contribution of elevated Stripe latency has not been ruled out.',
      resolution: 'Connection pool size was reverted to 50 per pod.',
      correctiveActions: ['Add a load test gate for connection-pool-affecting config changes.'],
      lessonsLearned: ['Infrastructure-affecting config changes need the same review as code.'],
      followUpItems: ['Add an alert on connection pool saturation.'],
      provider: 'mock',
      model: 'mock-deterministic-v1',
      promptVersion: 'postmortem-v1',
      generatedAt: '2026-06-14T15:10:00Z',
      lastEditedAt: null,
    };
    expect(PostmortemSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a postmortem never generated by AI (all provenance fields null)', () => {
    const valid = {
      incidentSummary: 'A manually written summary.',
      impact: '',
      detection: '',
      timeline: '',
      contributingFactors: [],
      hypothesesInvestigated: [],
      likelyCause: '',
      uncertaintyStatement: '',
      resolution: '',
      correctiveActions: [],
      lessonsLearned: [],
      followUpItems: [],
      provider: null,
      model: null,
      promptVersion: null,
      generatedAt: null,
      lastEditedAt: null,
    };
    expect(PostmortemSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a postmortem missing incidentSummary', () => {
    const invalid = {
      impact: '',
      detection: '',
      timeline: '',
      contributingFactors: [],
      hypothesesInvestigated: [],
      likelyCause: '',
      uncertaintyStatement: '',
      resolution: '',
      correctiveActions: [],
      lessonsLearned: [],
      followUpItems: [],
      provider: null,
      model: null,
      promptVersion: null,
      generatedAt: null,
      lastEditedAt: null,
    };
    expect(PostmortemSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects an invalid provider value', () => {
    const invalid = {
      incidentSummary: 'x',
      impact: '',
      detection: '',
      timeline: '',
      contributingFactors: [],
      hypothesesInvestigated: [],
      likelyCause: '',
      uncertaintyStatement: '',
      resolution: '',
      correctiveActions: [],
      lessonsLearned: [],
      followUpItems: [],
      provider: 'azure-openai',
      model: null,
      promptVersion: null,
      generatedAt: null,
      lastEditedAt: null,
    };
    expect(PostmortemSchema.safeParse(invalid).success).toBe(false);
  });
});
