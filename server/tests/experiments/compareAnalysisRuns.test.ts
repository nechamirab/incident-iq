import { describe, expect, it } from 'vitest';
import { compareAnalysisRuns } from '../../src/experiments/compareAnalysisRuns.js';
import { evaluateAnalysisQuality } from '../../src/ai/validators/analysisQualityEvaluator.js';
import { sampleIncidents } from '../../src/data/incidents/index.js';
import { buildAnalysisRun } from '../helpers/analysisRunFixture.js';
import { buildValidAiResponse } from '../helpers/aiResponseFixtures.js';

const incident = sampleIncidents[0];
const evidenceId = incident.evidence[0].id;

describe('compareAnalysisRuns', () => {
  it('reports the leading hypothesis and confidence for both sides', () => {
    const runA = buildAnalysisRun(incident, evidenceId);
    const runB = buildAnalysisRun(incident, evidenceId, {
      hypotheses: buildValidAiResponse({}, evidenceId).hypotheses.map((h) => ({ ...h, title: `${h.title} (variant)` })),
    });
    const qualityA = evaluateAnalysisQuality(buildValidAiResponse({}, evidenceId), incident.evidence.length);
    const qualityB = evaluateAnalysisQuality(buildValidAiResponse({}, evidenceId), incident.evidence.length);

    const comparison = compareAnalysisRuns(
      incident.id,
      { label: 'A', run: runA, quality: qualityA },
      { label: 'B', run: runB, quality: qualityB },
    );

    expect(comparison.leadingHypothesisTitleA).toBe('Hypothesis one');
    expect(comparison.leadingHypothesisTitleB).toBe('Hypothesis one (variant)');
    expect(comparison.leadingHypothesisConfidenceA).toBe(50);
    expect(comparison.totalHypothesesA).toBe(3);
  });

  it('counts hypotheses with contradicting evidence independently per side', () => {
    const runNoContradiction = buildAnalysisRun(incident, evidenceId, {
      hypotheses: buildValidAiResponse({}, evidenceId).hypotheses.map((h) => ({
        ...h,
        contradictingEvidenceIds: [],
      })),
    });
    const runWithContradiction = buildAnalysisRun(incident, evidenceId);
    const quality = evaluateAnalysisQuality(buildValidAiResponse({}, evidenceId), incident.evidence.length);

    const comparison = compareAnalysisRuns(
      incident.id,
      { label: 'no-contradiction', run: runNoContradiction, quality },
      { label: 'with-contradiction', run: runWithContradiction, quality },
    );

    expect(comparison.hypothesesWithContradictingEvidenceA).toBe(0);
    expect(comparison.hypothesesWithContradictingEvidenceB).toBeGreaterThan(0);
  });

  it('carries through each side\'s completeness/quality warnings unchanged', () => {
    const run = buildAnalysisRun(incident, evidenceId);
    const emptyRiskResponse = buildValidAiResponse({ reasoningRisks: [] }, evidenceId);
    const quality = evaluateAnalysisQuality(emptyRiskResponse, incident.evidence.length);

    const comparison = compareAnalysisRuns(
      incident.id,
      { label: 'A', run, quality },
      { label: 'B', run, quality: { completenessWarnings: [], qualityWarnings: [] } },
    );

    expect(comparison.completenessWarningsA.length).toBeGreaterThan(0);
    expect(comparison.completenessWarningsB).toEqual([]);
  });
});
