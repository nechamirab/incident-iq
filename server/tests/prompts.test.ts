import { describe, expect, it } from 'vitest';
import { buildIncidentAnalysisPrompt } from '../src/ai/prompts/incidentAnalysisV1.js';
import { buildRepairPrompt } from '../src/ai/prompts/repairInvalidJsonV1.js';
import { sampleIncidents } from '../src/data/incidents/index.js';

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
