import { describe, expect, it } from 'vitest';
import { buildIncidentAnalysisPrompt, INCIDENT_ANALYSIS_PROMPT_VERSION } from '../src/ai/prompts/incidentAnalysisV1.js';
import { buildIncidentAnalysisPromptV2, INCIDENT_ANALYSIS_V2_PROMPT_VERSION } from '../src/ai/prompts/incidentAnalysisV2.js';
import { buildTargetedCompletionRepairPrompt } from '../src/ai/prompts/targetedCompletionRepairV1.js';
import { buildPostmortemPrompt } from '../src/ai/prompts/postmortemV1.js';
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

describe('buildIncidentAnalysisPromptV2', () => {
  const incident = sampleIncidents[0];
  const prompt = buildIncidentAnalysisPromptV2(incident);

  it('is versioned distinctly from v1, and v1 is preserved unchanged (for prompt-comparison experiments)', () => {
    expect(INCIDENT_ANALYSIS_V2_PROMPT_VERSION).toBe('incident-analysis-v2');
    expect(INCIDENT_ANALYSIS_PROMPT_VERSION).toBe('incident-analysis-v1');
    expect(INCIDENT_ANALYSIS_V2_PROMPT_VERSION).not.toBe(INCIDENT_ANALYSIS_PROMPT_VERSION);
  });

  it('includes every evidence id in the user prompt so the model can cite them', () => {
    for (const item of incident.evidence) {
      expect(prompt.user).toContain(item.id);
    }
  });

  it('explicitly instructs the model to actively search for contradicting evidence', () => {
    expect(prompt.system.toLowerCase()).toContain('actively');
    expect(prompt.system.toLowerCase()).toContain('contradict');
  });

  it('instructs the model to explain an empty contradicting-evidence list rather than leave it silent', () => {
    expect(prompt.system).toMatch(/confidenceReason/);
    expect(prompt.system.toLowerCase()).toContain('unexplained');
  });

  it('instructs the model to ground reasoning risks in the specific incident, not a generic list', () => {
    expect(prompt.system.toLowerCase()).toContain('generic list');
  });

  it('forbids generic recommended actions and requires an evidence/hypothesis/question link', () => {
    expect(prompt.system.toLowerCase()).toContain('check the logs');
    expect(prompt.system.toLowerCase()).toContain('investigate further');
  });

  it('restricts bias types to the exact schema-supported list', () => {
    expect(prompt.system).toContain('confirmation-bias');
    expect(prompt.system).toContain('base-rate-neglect');
    expect(prompt.system.toLowerCase()).toContain('never invent a different bias name');
  });

  it('warns against presenting correlation as proven causation', () => {
    expect(prompt.system.toLowerCase()).toContain('correlation');
    expect(prompt.system.toLowerCase()).toContain('causal');
  });

  it('includes a clearly-labeled illustrative example using synthetic, unrelated evidence ids', () => {
    expect(prompt.system).toContain('Illustrative example only');
    expect(prompt.system).toContain('example-ev-01');
    // The example must never leak into what the model is told to reuse verbatim.
    expect(prompt.system.toLowerCase()).toContain('not content to copy');
  });
});

describe('buildTargetedCompletionRepairPrompt', () => {
  const incident = sampleIncidents[0];
  const originalPrompt = buildIncidentAnalysisPromptV2(incident);
  const knownEvidenceIds = incident.evidence.map((item) => item.id);

  it('lists the known evidence ids so the repair cannot invent new ones', () => {
    const repair = buildTargetedCompletionRepairPrompt(
      originalPrompt,
      '{"reasoningRisks": []}',
      ['empty-reasoning-risks'],
      knownEvidenceIds,
    );
    for (const id of knownEvidenceIds) {
      expect(repair.system).toContain(id);
    }
    expect(repair.system.toLowerCase()).toContain('do not invent new evidence ids');
  });

  it('describes only the targeted deficiency, not every possible one', () => {
    const repair = buildTargetedCompletionRepairPrompt(
      originalPrompt,
      '{}',
      ['empty-recommended-actions'],
      knownEvidenceIds,
    );
    expect(repair.user).toContain('recommendedActions');
    // Deficiencies that were NOT targeted must not be described in this repair request.
    expect(repair.user).not.toContain('"reasoningRisks" is empty');
    expect(repair.user).not.toContain('"openQuestions" is empty');
  });

  it('instructs the model to leave facts and summary unchanged', () => {
    const repair = buildTargetedCompletionRepairPrompt(originalPrompt, '{}', ['empty-open-questions'], knownEvidenceIds);
    expect(repair.system.toLowerCase()).toContain('unchanged');
    expect(repair.system).toContain('facts');
  });

  it('includes the previous response text for the model to build on', () => {
    const previousResponse = '{"marker-for-test": "abc123"}';
    const repair = buildTargetedCompletionRepairPrompt(originalPrompt, previousResponse, ['empty-open-questions'], knownEvidenceIds);
    expect(repair.user).toContain(previousResponse);
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

describe('buildPostmortemPrompt', () => {
  const incident = sampleIncidents[0];
  const run = buildAnalysisRun(incident, incident.evidence[0].id);
  const prompt = buildPostmortemPrompt(incident, run);

  it('includes the incident status and resolvedAt so the model never invents a resolution', () => {
    expect(prompt.user).toContain(`Status: ${incident.status}`);
    expect(prompt.user.toLowerCase()).toContain('not yet resolved');
    expect(prompt.system.toLowerCase()).toContain('resolution');
  });

  it("includes every hypothesis's title, confidence, and status", () => {
    for (const hypothesis of run.hypotheses) {
      expect(prompt.user).toContain(hypothesis.title);
      expect(prompt.user).toContain(`confidence ${hypothesis.confidence}/100`);
      expect(prompt.user).toContain(`status: ${hypothesis.status}`);
    }
  });

  it('includes every evidence id so the model can ground its draft in it', () => {
    for (const item of incident.evidence) {
      expect(prompt.user).toContain(item.id);
    }
  });

  it('instructs the model to hedge the likely cause unless a hypothesis is human-confirmed', () => {
    expect(prompt.system.toLowerCase()).toContain('confirmed-by-human');
    expect(prompt.system.toLowerCase()).toContain('hedged language');
  });

  it("includes the run's recommended actions and open questions", () => {
    for (const action of run.recommendedActions) {
      expect(prompt.user).toContain(action.title);
    }
    for (const question of run.openQuestions) {
      expect(prompt.user).toContain(question);
    }
  });
});
