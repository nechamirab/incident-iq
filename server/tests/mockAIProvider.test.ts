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
});
