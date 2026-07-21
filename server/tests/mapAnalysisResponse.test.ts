import { describe, expect, it } from 'vitest';
import { mapAiResponseToAnalysisRun } from '../src/ai/mapAnalysisResponse.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { buildValidAiResponse } from './helpers/aiResponseFixtures.js';

const incident = sampleIncidents[0];
const evidenceId = incident.evidence[0].id;

function mapWith(overrides: Parameters<typeof buildValidAiResponse>[0] = {}) {
  return mapAiResponseToAnalysisRun({
    incident,
    response: buildValidAiResponse(overrides, evidenceId),
    providerName: 'mock',
    model: 'mock-deterministic-v1',
    promptVersion: 'incident-analysis-v1',
    durationMs: 42,
    rawResponse: { rawText: '{}', repaired: false },
  });
}

describe('mapAiResponseToAnalysisRun', () => {
  it('stamps the run with the given provider, model, prompt version, and incident id', () => {
    const run = mapWith();
    expect(run.incidentId).toBe(incident.id);
    expect(run.provider).toBe('mock');
    expect(run.model).toBe('mock-deterministic-v1');
    expect(run.promptVersion).toBe('incident-analysis-v1');
    expect(run.status).toBe('completed');
    expect(run.durationMs).toBe(42);
  });

  it('assigns a unique id to every hypothesis and sets status to proposed', () => {
    const run = mapWith();
    expect(run.hypotheses).toHaveLength(3);
    expect(new Set(run.hypotheses.map((h) => h.id)).size).toBe(3);
    expect(run.hypotheses.every((h) => h.status === 'proposed')).toBe(true);
  });

  it('sets category and reviewStatus on facts and assumptions', () => {
    const run = mapWith();
    expect(run.facts.every((f) => f.category === 'fact' && f.reviewStatus === 'unreviewed')).toBe(true);
  });

  it('sets status to suggested on every recommended action', () => {
    const run = mapWith();
    expect(run.recommendedActions.every((a) => a.status === 'suggested')).toBe(true);
  });

  it('resolves a recommended action\'s tempId reference to the matching hypothesis id', () => {
    const run = mapWith();
    const firstHypothesisId = run.hypotheses[0].id;
    expect(run.recommendedActions[0].relatedHypothesisIds).toEqual([firstHypothesisId]);
  });

  it('drops an unresolvable tempId reference and records a validation warning', () => {
    const response = buildValidAiResponse({}, evidenceId);
    response.recommendedActions[0].relatedHypothesisIds = ['H-does-not-exist'];
    const run = mapAiResponseToAnalysisRun({
      incident,
      response,
      providerName: 'mock',
      model: 'mock-deterministic-v1',
      promptVersion: 'incident-analysis-v1',
      durationMs: 1,
      rawResponse: {},
    });

    expect(run.recommendedActions[0].relatedHypothesisIds).toEqual([]);
    expect(run.validationWarnings.some((w) => w.includes('H-does-not-exist'))).toBe(true);
  });

  it('records a validation warning for an unknown evidence id', () => {
    const run = mapWith({
      facts: [
        {
          statement: 'A fact citing an unknown id.',
          explanation: 'x',
          evidenceIds: ['does-not-exist'],
          confidence: 50,
        },
      ],
    });
    expect(run.validationWarnings.some((w) => w.includes('does-not-exist'))).toBe(true);
  });

  it('merges self-reported and detected unsupported claims without duplicates', () => {
    const statement = 'A fact with no real backing.';
    const run = mapWith({
      facts: [{ statement, explanation: 'x', evidenceIds: ['unknown-id'], confidence: 50 }],
      unsupportedClaims: [statement, 'A separately self-reported claim.'],
    });

    expect(run.unsupportedClaims).toContain(statement);
    expect(run.unsupportedClaims).toContain('A separately self-reported claim.');
    expect(run.unsupportedClaims.filter((c) => c === statement)).toHaveLength(1);
  });

  it('computes a real inputHash and a recent createdAt', () => {
    const run = mapWith();
    expect(run.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Number.isNaN(Date.parse(run.createdAt))).toBe(false);
  });
});
