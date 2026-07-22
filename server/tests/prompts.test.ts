import { describe, expect, it } from 'vitest';
import { buildIncidentAnalysisPrompt } from '../src/ai/prompts/incidentAnalysisV1.js';
import { buildRepairPrompt } from '../src/ai/prompts/repairInvalidJsonV1.js';
import { buildSkepticReviewPrompt, findLeadingHypothesis } from '../src/ai/prompts/skepticReviewV1.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { buildAnalysisRun } from './helpers/analysisRunFixture.js';

describe('buildIncidentAnalysisPrompt', () => {
  const incident = sampleIncidents[0];
  const prompt = buildIncidentAnalysisPrompt(incident);

  it('includes every evidence id in the user prompt so the model can cite them', () => {
    for (const item of incident.evidence) {
      expect(prompt.user).toContain(item.id);
    }
  });

  it('includes the incident title, severity, and affected service', () => {
    expect(prompt.user).toContain(incident.title);
    expect(prompt.user).toContain(incident.severity);
    expect(prompt.user).toContain(incident.affectedService);
  });

  it('instructs the model to use only supplied evidence and avoid inventing timestamps', () => {
    expect(prompt.system.toLowerCase()).toContain('use only');
    expect(prompt.system.toLowerCase()).toContain('invent');
  });

  it('requires at least three hypotheses and evidence-cited facts', () => {
    expect(prompt.system).toMatch(/at least three/i);
    expect(prompt.system).toMatch(/evidence id/i);
  });
});

describe('buildRepairPrompt', () => {
  const incident = sampleIncidents[0];
  const originalPrompt = buildIncidentAnalysisPrompt(incident);

  it('includes the validation issues and the previous response', () => {
    const repair = buildRepairPrompt(originalPrompt, '{"bad": true}', 'hypotheses: too few');
    expect(repair.user).toContain('hypotheses: too few');
    expect(repair.user).toContain('{"bad": true}');
  });

  it('reuses the original system prompt', () => {
    const repair = buildRepairPrompt(originalPrompt, '{}', 'issue');
    expect(repair.system).toBe(originalPrompt.system);
  });

  it('truncates a very long previous response', () => {
    const hugeResponse = 'x'.repeat(10_000);
    const repair = buildRepairPrompt(originalPrompt, hugeResponse, 'issue');
    expect(repair.user.length).toBeLessThan(hugeResponse.length);
    expect(repair.user).toContain('truncated');
  });
});

describe('findLeadingHypothesis', () => {
  it('returns the hypothesis with the highest confidence', () => {
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    const leading = findLeadingHypothesis(run);
    expect(leading.confidence).toBe(Math.max(...run.hypotheses.map((h) => h.confidence)));
  });
});

describe('buildSkepticReviewPrompt', () => {
  const incident = sampleIncidents[0];
  const run = buildAnalysisRun(incident, incident.evidence[0].id);
  const leading = findLeadingHypothesis(run);
  const prompt = buildSkepticReviewPrompt(incident, run);

  it('names the leading hypothesis to challenge, in both system and user prompt', () => {
    expect(prompt.system).toContain(leading.title);
    expect(prompt.user).toContain(leading.title);
    expect(prompt.system.toUpperCase()).toContain('CHALLENGE');
  });

  it('includes every evidence id so the model can cite them', () => {
    for (const item of incident.evidence) {
      expect(prompt.user).toContain(item.id);
    }
  });

  it("includes every hypothesis's id and confidence, marking which one is leading", () => {
    for (const hypothesis of run.hypotheses) {
      expect(prompt.user).toContain(hypothesis.id);
      expect(prompt.user).toContain(hypothesis.title);
    }
    expect(prompt.user).toContain('LEADING HYPOTHESIS TO CHALLENGE');
  });

  it('instructs the model not to report the ignored-evidence list or hypothesis id itself', () => {
    expect(prompt.system.toLowerCase()).toContain('ignored');
  });
});
