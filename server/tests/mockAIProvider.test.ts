import { describe, expect, it } from 'vitest';
import { MockAIProvider } from '../src/ai/providers/MockAIProvider.js';
import { buildIncidentAnalysisPrompt } from '../src/ai/prompts/incidentAnalysisV1.js';
import { validateAIResponse } from '../src/ai/validators/validateAIResponse.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
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
