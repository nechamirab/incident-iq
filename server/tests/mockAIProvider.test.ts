import { describe, expect, it } from 'vitest';
import { MockAIProvider } from '../src/ai/providers/MockAIProvider.js';
import { buildIncidentAnalysisPrompt } from '../src/ai/prompts/incidentAnalysisV1.js';
import { buildPostmortemPrompt } from '../src/ai/prompts/postmortemV1.js';
import { buildSkepticReviewPrompt, findLeadingHypothesis } from '../src/ai/prompts/skepticReviewV1.js';
import { validateAIResponse } from '../src/ai/validators/validateAIResponse.js';
import { validatePostmortemResponse } from '../src/ai/validators/validatePostmortemResponse.js';
import { validateSkepticReviewResponse } from '../src/ai/validators/validateSkepticReviewResponse.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { buildAnalysisRun } from './helpers/analysisRunFixture.js';
import type { AnalysisRun } from '../../shared/types/analysisRun.js';
import type { Incident } from '../../shared/types/incident.js';

function buildMinimalIncident(): Incident {
  const now = '2026-07-01T00:00:00Z';
  return {
    id: 'incident-minimal',
    title: 'Minimal incident',
    description: 'Very little is known so far.',
    scenarioType: 'custom',
    status: 'draft',
    severity: 'low',
    affectedService: 'unknown-service',
    startedAt: null,
    detectedAt: now,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
    evidence: [
      {
        id: 'ev-description',
        incidentId: 'incident-minimal',
        sourceType: 'incident-description',
        sourceName: 'Incident description',
        originalContent: 'Very little is known so far.',
        normalizedContent: 'Very little is known so far.',
        timestamp: null,
        lineNumber: null,
        metadata: {},
        createdAt: now,
      },
    ],
    analysisRuns: [],
    skepticReviews: [],
    postmortem: null,
  };
}

describe('MockAIProvider', () => {
  const provider = new MockAIProvider();

  it('identifies itself honestly as the mock provider', () => {
    expect(provider.name).toBe('mock');
    expect(provider.model.toLowerCase()).toContain('mock');
  });

  it('is deterministic: the same incident produces the same output', async () => {
    const incident = sampleIncidents[0];
    const prompt = buildIncidentAnalysisPrompt(incident);
    const first = await provider.complete(incident, prompt);
    const second = await provider.complete(incident, prompt);
    expect(first).toBe(second);
  });

  it.each(sampleIncidents.map((incident) => [incident.title, incident] as const))(
    'produces schema-valid output for sample incident: %s',
    async (_title, incident) => {
      const prompt = buildIncidentAnalysisPrompt(incident);
      const rawText = await provider.complete(incident, prompt);
      const result = validateAIResponse(rawText);
      expect(result.success, result.success ? undefined : result.issues).toBe(true);
    },
  );

  it('produces at least three hypotheses even for a minimal, evidence-sparse incident', async () => {
    const incident = buildMinimalIncident();
    const prompt = buildIncidentAnalysisPrompt(incident);
    const rawText = await provider.complete(incident, prompt);
    const result = validateAIResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hypotheses.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('only ever cites evidence ids that actually belong to the incident', async () => {
    for (const incident of [...sampleIncidents, buildMinimalIncident()]) {
      const prompt = buildIncidentAnalysisPrompt(incident);
      const rawText = await provider.complete(incident, prompt);
      const result = validateAIResponse(rawText);
      expect(result.success).toBe(true);
      if (!result.success) continue;

      const knownIds = new Set(incident.evidence.map((item) => item.id));
      const allCitedIds = [
        ...result.data.facts.flatMap((f) => f.evidenceIds),
        ...result.data.assumptions.flatMap((a) => a.evidenceIds),
        ...result.data.timeline.flatMap((t) => t.evidenceIds),
        ...result.data.hypotheses.flatMap((h) => [...h.supportingEvidenceIds, ...h.contradictingEvidenceIds]),
        ...result.data.reasoningRisks.flatMap((r) => r.evidenceIds),
        ...result.data.recommendedActions.flatMap((a) => a.evidenceIds),
      ];
      for (const id of allCitedIds) {
        expect(knownIds.has(id)).toBe(true);
      }
    }
  });

  it('flags itself as a reasoning risk needing human review', async () => {
    const incident = sampleIncidents[0];
    const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
    const result = validateAIResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoningRisks.some((risk) => risk.biasType === 'automation-bias')).toBe(true);
    }
  });

  it.each([...sampleIncidents.map((i) => [i.title, i] as const), ['minimal incident', buildMinimalIncident()] as const])(
    'identifies at least three reasoning risks for: %s',
    async (_label, incident) => {
      const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
      const result = validateAIResponse(rawText);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reasoningRisks.length).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it('flags confirmation-bias when a hypothesis lists no contradicting evidence', async () => {
    const incident = sampleIncidents[0];
    const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
    const result = validateAIResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoningRisks.some((risk) => risk.biasType === 'confirmation-bias')).toBe(true);
    }
  });

  it('flags base-rate-neglect for an evidence-sparse incident', async () => {
    const incident = buildMinimalIncident();
    const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
    const result = validateAIResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoningRisks.some((risk) => risk.biasType === 'base-rate-neglect')).toBe(true);
    }
  });

  it('does not flag base-rate-neglect for a richly-evidenced sample incident', async () => {
    const incident = sampleIncidents[0];
    expect(incident.evidence.length).toBeGreaterThanOrEqual(5);
    const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
    const result = validateAIResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoningRisks.some((risk) => risk.biasType === 'base-rate-neglect')).toBe(false);
    }
  });

  it('flags anchoring-bias when evidence predates the incident start time', async () => {
    // sample-ecommerce-checkout has a cache-warmer warning at 14:20 UTC,
    // ten minutes before the incident's recorded 14:30 UTC start.
    const incident = sampleIncidents[0];
    const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
    const result = validateAIResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      const anchoring = result.data.reasoningRisks.find((risk) => risk.biasType === 'anchoring-bias');
      expect(anchoring).toBeDefined();
      expect(anchoring?.evidenceIds.length).toBeGreaterThan(0);
    }
  });

  it('does not flag anchoring-bias when the incident has no recorded start time', async () => {
    const incident = buildMinimalIncident();
    const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
    const result = validateAIResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoningRisks.some((risk) => risk.biasType === 'anchoring-bias')).toBe(false);
    }
  });

  it('flags post-hoc-fallacy only when deployment-note evidence is present', async () => {
    const withDeployment = sampleIncidents[0];
    const withoutDeployment = buildMinimalIncident();

    const withResult = validateAIResponse(
      await provider.complete(withDeployment, buildIncidentAnalysisPrompt(withDeployment)),
    );
    const withoutResult = validateAIResponse(
      await provider.complete(withoutDeployment, buildIncidentAnalysisPrompt(withoutDeployment)),
    );

    expect(withResult.success && withResult.data.reasoningRisks.some((r) => r.biasType === 'post-hoc-fallacy')).toBe(
      true,
    );
    expect(
      withoutResult.success && withoutResult.data.reasoningRisks.some((r) => r.biasType === 'post-hoc-fallacy'),
    ).toBe(false);
  });

  describe('recommended actions are concrete, not generic', () => {
    const bannedPhrases = ['investigate further', 'check the logs', 'debug the issue'];

    it.each(sampleIncidents.map((incident) => [incident.title, incident] as const))(
      'avoids generic advice for: %s',
      async (_title, incident) => {
        const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
        const result = validateAIResponse(rawText);
        expect(result.success).toBe(true);
        if (!result.success) return;

        for (const action of result.data.recommendedActions) {
          const lowerDescription = action.description.toLowerCase();
          for (const phrase of bannedPhrases) {
            expect(lowerDescription).not.toContain(phrase);
          }
          // Every action must name a concrete detail: a time window drawn
          // from the evidence's own timestamps, or an explicit count.
          expect(/\b(between|around)\b/.test(lowerDescription) || /\d+ /.test(action.description)).toBe(
            true,
          );
        }
      },
    );

    it('names a specific database metric for a database-error-derived action', async () => {
      // Purpose-built so database-error is unambiguously the largest
      // cluster (sample incidents mix several evidence types, and the
      // mock only keeps its top 4 clusters -- this avoids depending on
      // which types happen to survive that cap).
      const now = '2026-07-01T00:00:00Z';
      const incident = buildMinimalIncident();
      incident.evidence.push(
        {
          id: 'ev-db-1',
          incidentId: incident.id,
          sourceType: 'database-error',
          sourceName: 'db.log',
          originalContent: 'connection timeout',
          normalizedContent: 'connection timeout',
          timestamp: now,
          lineNumber: 1,
          metadata: {},
          createdAt: now,
        },
        {
          id: 'ev-db-2',
          incidentId: incident.id,
          sourceType: 'database-error',
          sourceName: 'db.log',
          originalContent: 'too many connections',
          normalizedContent: 'too many connections',
          timestamp: now,
          lineNumber: 2,
          metadata: {},
          createdAt: now,
        },
      );

      const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
      const result = validateAIResponse(rawText);
      expect(result.success).toBe(true);
      if (result.success) {
        const dbAction = result.data.recommendedActions.find((a) => a.category === 'database-check');
        expect(dbAction?.description.toLowerCase()).toMatch(/connection-pool|query latency/);
      }
    });
  });
});

function buildBareRun(overrides: Partial<AnalysisRun> = {}): AnalysisRun {
  const now = '2026-07-01T00:10:00Z';
  return {
    id: 'run-bare',
    incidentId: 'incident-minimal',
    provider: 'mock',
    model: 'mock-deterministic-v1',
    promptVersion: 'incident-analysis-v1',
    createdAt: now,
    inputHash: 'hash',
    durationMs: 1,
    status: 'completed',
    summary: { text: 'Summary', affectedComponents: [], impact: 'Unknown' },
    timeline: [],
    facts: [],
    assumptions: [],
    hypotheses: [],
    reasoningRisks: [],
    recommendedActions: [],
    openQuestions: [],
    unsupportedClaims: [],
    uncertaintyStatement: 'Test fixture.',
    validationWarnings: [],
    rawResponse: null,
    ...overrides,
  };
}

describe('MockAIProvider skeptic review', () => {
  const provider = new MockAIProvider();

  it('is deterministic: the same incident and run produce the same output', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    const prompt = buildSkepticReviewPrompt(incident, run);

    const first = await provider.complete(incident, prompt, { kind: 'skeptic-review', analysisRun: run });
    const second = await provider.complete(incident, prompt, { kind: 'skeptic-review', analysisRun: run });
    expect(first).toBe(second);
  });

  it.each(sampleIncidents.map((incident) => [incident.title, incident] as const))(
    'produces schema-valid output for a real analysis run of sample incident: %s',
    async (_title, incident) => {
      const run = buildAnalysisRun(incident, incident.evidence[0].id);
      const prompt = buildSkepticReviewPrompt(incident, run);
      const rawText = await provider.complete(incident, prompt, { kind: 'skeptic-review', analysisRun: run });
      const result = validateSkepticReviewResponse(rawText);
      expect(result.success, result.success ? undefined : result.issues).toBe(true);
    },
  );

  it('challenges the leading (highest-confidence) hypothesis by name', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    const leading = [...run.hypotheses].sort((a, b) => b.confidence - a.confidence)[0];

    const rawText = await provider.complete(incident, buildSkepticReviewPrompt(incident, run), {
      kind: 'skeptic-review',
      analysisRun: run,
    });
    const result = validateSkepticReviewResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.challengeSummary).toContain(leading.title);
      expect(result.data.falsificationTest.length).toBeGreaterThan(0);
    }
  });

  it('reframes the run\'s other hypotheses as alternative explanations', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    const nonLeading = [...run.hypotheses].sort((a, b) => b.confidence - a.confidence).slice(1);

    const rawText = await provider.complete(incident, buildSkepticReviewPrompt(incident, run), {
      kind: 'skeptic-review',
      analysisRun: run,
    });
    const result = validateSkepticReviewResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alternativeExplanations).toHaveLength(nonLeading.length);
      for (const hypothesis of nonLeading) {
        expect(result.data.alternativeExplanations.some((text) => text.includes(hypothesis.title))).toBe(
          true,
        );
      }
    }
  });

  it('falls back to a generic falsification test when the leading hypothesis cites no resolvable evidence', async () => {
    const incident = sampleIncidents[0];
    const run = buildBareRun({
      incidentId: incident.id,
      hypotheses: [
        {
          id: 'h-1',
          title: 'Untraceable hypothesis',
          description: 'x',
          confidence: 60,
          confidenceReason: 'x',
          supportingEvidenceIds: ['evidence-not-on-incident'],
          contradictingEvidenceIds: [],
          assumptions: [],
          recommendedTest: 'x',
          expectedResult: 'x',
          status: 'proposed',
        },
        {
          id: 'h-2',
          title: 'Second hypothesis',
          description: 'x',
          confidence: 30,
          confidenceReason: 'x',
          supportingEvidenceIds: [],
          contradictingEvidenceIds: [],
          assumptions: [],
          recommendedTest: 'x',
          expectedResult: 'x',
          status: 'proposed',
        },
      ],
    });

    const rawText = await provider.complete(incident, buildSkepticReviewPrompt(incident, run), {
      kind: 'skeptic-review',
      analysisRun: run,
    });
    const result = validateSkepticReviewResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.falsificationTest).toContain('Untraceable hypothesis');
    }
  });

  it('notes that no alternatives were proposed when the run has only one hypothesis', async () => {
    const incident = sampleIncidents[0];
    const run = buildBareRun({
      incidentId: incident.id,
      hypotheses: [
        {
          id: 'h-only',
          title: 'Only hypothesis',
          description: 'x',
          confidence: 40,
          confidenceReason: 'x',
          supportingEvidenceIds: [],
          contradictingEvidenceIds: [],
          assumptions: [],
          recommendedTest: 'x',
          expectedResult: 'x',
          status: 'proposed',
        },
      ],
    });

    const rawText = await provider.complete(incident, buildSkepticReviewPrompt(incident, run), {
      kind: 'skeptic-review',
      analysisRun: run,
    });
    const result = validateSkepticReviewResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alternativeExplanations).toHaveLength(1);
      expect(result.data.alternativeExplanations[0]).toMatch(/no alternative hypotheses/i);
    }
  });

  it('falls back to producing the main analysis when no analysisRun context is given', async () => {
    const incident = sampleIncidents[0];
    const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
    const result = validateAIResponse(rawText);
    expect(result.success).toBe(true);
  });
});

describe('MockAIProvider postmortem', () => {
  const provider = new MockAIProvider();

  it('is deterministic: the same incident and run produce the same output', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    const prompt = buildPostmortemPrompt(incident, run);

    const first = await provider.complete(incident, prompt, { kind: 'postmortem', analysisRun: run });
    const second = await provider.complete(incident, prompt, { kind: 'postmortem', analysisRun: run });
    expect(first).toBe(second);
  });

  it.each(sampleIncidents.map((incident) => [incident.title, incident] as const))(
    'produces schema-valid output for a real analysis run of sample incident: %s',
    async (_title, incident) => {
      const run = buildAnalysisRun(incident, incident.evidence[0].id);
      const prompt = buildPostmortemPrompt(incident, run);
      const rawText = await provider.complete(incident, prompt, { kind: 'postmortem', analysisRun: run });
      const result = validatePostmortemResponse(rawText);
      expect(result.success, result.success ? undefined : result.issues).toBe(true);
    },
  );

  it('names the leading hypothesis in the likely cause, using hedged language by default', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    const leading = findLeadingHypothesis(run);

    const rawText = await provider.complete(incident, buildPostmortemPrompt(incident, run), {
      kind: 'postmortem',
      analysisRun: run,
    });
    const result = validatePostmortemResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.likelyCause).toContain(leading.title);
      expect(result.data.likelyCause).toContain(String(leading.confidence));
      expect(result.data.likelyCause.toLowerCase()).toContain('the available evidence suggests');
    }
  });

  it('states the confirmed cause without hedging when the leading hypothesis is human-confirmed', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    const confirmedRun: AnalysisRun = {
      ...run,
      hypotheses: run.hypotheses.map((hypothesis, index) =>
        index === 0 ? { ...hypothesis, status: 'confirmed-by-human' as const } : hypothesis,
      ),
    };

    const rawText = await provider.complete(incident, buildPostmortemPrompt(incident, confirmedRun), {
      kind: 'postmortem',
      analysisRun: confirmedRun,
    });
    const result = validatePostmortemResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.likelyCause).toContain('confirmed cause');
      expect(result.data.likelyCause).toContain('human reviewer');
    }
  });

  it('lists every hypothesis investigated, not only the leading one', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);

    const rawText = await provider.complete(incident, buildPostmortemPrompt(incident, run), {
      kind: 'postmortem',
      analysisRun: run,
    });
    const result = validatePostmortemResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hypothesesInvestigated).toHaveLength(run.hypotheses.length);
      for (const hypothesis of run.hypotheses) {
        expect(result.data.hypothesesInvestigated.some((text) => text.includes(hypothesis.title))).toBe(
          true,
        );
      }
    }
  });

  it('states the incident is not yet resolved when its status is not "resolved"', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    expect(incident.status).not.toBe('resolved');

    const rawText = await provider.complete(incident, buildPostmortemPrompt(incident, run), {
      kind: 'postmortem',
      analysisRun: run,
    });
    const result = validatePostmortemResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resolution.toLowerCase()).toContain('not yet been marked resolved');
    }
  });

  it('states the resolvedAt timestamp when the incident is resolved', async () => {
    const incident: Incident = {
      ...sampleIncidents[0],
      status: 'resolved',
      resolvedAt: '2026-06-14T16:00:00Z',
    };
    const run = buildAnalysisRun(incident, incident.evidence[0].id);

    const rawText = await provider.complete(incident, buildPostmortemPrompt(incident, run), {
      kind: 'postmortem',
      analysisRun: run,
    });
    const result = validatePostmortemResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resolution).toContain('2026-06-14T16:00:00Z');
    }
  });

  it('derives lessons learned from the reasoning risks this analysis flagged about itself', async () => {
    const incident = sampleIncidents[0];
    const run = buildBareRun({
      incidentId: incident.id,
      hypotheses: buildAnalysisRun(incident, incident.evidence[0].id).hypotheses,
      reasoningRisks: [
        {
          id: 'bias-1',
          biasType: 'automation-bias',
          title: 'Mock analysis has not been reviewed',
          description: 'x',
          detectedIn: 'overall-analysis',
          evidenceIds: [],
          riskLevel: 'medium',
          mitigation: 'Have a human review any AI-generated hypothesis before acting on it.',
        },
      ],
    });

    const rawText = await provider.complete(incident, buildPostmortemPrompt(incident, run), {
      kind: 'postmortem',
      analysisRun: run,
    });
    const result = validatePostmortemResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lessonsLearned).toHaveLength(1);
      expect(result.data.lessonsLearned[0]).toContain('Have a human review any AI-generated hypothesis');
    }
  });

  it('falls back to a generic note when no reasoning risks were flagged', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    expect(run.reasoningRisks).toHaveLength(0);

    const rawText = await provider.complete(incident, buildPostmortemPrompt(incident, run), {
      kind: 'postmortem',
      analysisRun: run,
    });
    const result = validatePostmortemResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lessonsLearned).toHaveLength(1);
      expect(result.data.lessonsLearned[0]).toMatch(/no reasoning risks/i);
    }
  });

  it('draws follow-up items from the run\'s open questions', async () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);

    const rawText = await provider.complete(incident, buildPostmortemPrompt(incident, run), {
      kind: 'postmortem',
      analysisRun: run,
    });
    const result = validatePostmortemResponse(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.followUpItems).toEqual(run.openQuestions);
    }
  });

  it('falls back to producing the main analysis when no context is given', async () => {
    const incident = sampleIncidents[0];
    const rawText = await provider.complete(incident, buildIncidentAnalysisPrompt(incident));
    const result = validateAIResponse(rawText);
    expect(result.success).toBe(true);
  });
});
