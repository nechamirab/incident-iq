import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { AnalysisQualityReport } from '../ai/validators/analysisQualityEvaluator.js';

/** One side of a two-way analysis comparison, paired with the quality report computed alongside it. */
export interface ComparableAnalysis {
  label: string;
  run: AnalysisRun;
  quality: AnalysisQualityReport;
}

/**
 * A structural, evidence-grounded comparison of two analysis runs over the
 * same incident (e.g. produced by prompt v1 vs. v2, or by two different
 * providers). Every field is computed directly from the runs themselves --
 * nothing here interprets "better"/"worse"; that judgment is left to the
 * human reading the saved Markdown report.
 */
export interface AnalysisRunComparison {
  incidentId: string;
  labelA: string;
  labelB: string;
  leadingHypothesisTitleA: string;
  leadingHypothesisTitleB: string;
  leadingHypothesisConfidenceA: number;
  leadingHypothesisConfidenceB: number;
  hypothesesWithContradictingEvidenceA: number;
  hypothesesWithContradictingEvidenceB: number;
  totalHypothesesA: number;
  totalHypothesesB: number;
  reasoningRiskCountA: number;
  reasoningRiskCountB: number;
  recommendedActionCountA: number;
  recommendedActionCountB: number;
  completenessWarningsA: string[];
  completenessWarningsB: string[];
  qualityWarningsA: string[];
  qualityWarningsB: string[];
}

function findLeading(run: AnalysisRun): AnalysisRun['hypotheses'][number] {
  return [...run.hypotheses].sort((a, b) => b.confidence - a.confidence)[0];
}

/**
 * Builds a structural comparison between two analysis runs of the *same*
 * incident. Pure and provider-agnostic -- works identically whether `a`/`b`
 * came from different prompt versions, different providers, or different
 * prompt variants.
 */
export function compareAnalysisRuns(
  incidentId: string,
  a: ComparableAnalysis,
  b: ComparableAnalysis,
): AnalysisRunComparison {
  const leadingA = findLeading(a.run);
  const leadingB = findLeading(b.run);

  return {
    incidentId,
    labelA: a.label,
    labelB: b.label,
    leadingHypothesisTitleA: leadingA.title,
    leadingHypothesisTitleB: leadingB.title,
    leadingHypothesisConfidenceA: leadingA.confidence,
    leadingHypothesisConfidenceB: leadingB.confidence,
    hypothesesWithContradictingEvidenceA: a.run.hypotheses.filter((h) => h.contradictingEvidenceIds.length > 0)
      .length,
    hypothesesWithContradictingEvidenceB: b.run.hypotheses.filter((h) => h.contradictingEvidenceIds.length > 0)
      .length,
    totalHypothesesA: a.run.hypotheses.length,
    totalHypothesesB: b.run.hypotheses.length,
    reasoningRiskCountA: a.run.reasoningRisks.length,
    reasoningRiskCountB: b.run.reasoningRisks.length,
    recommendedActionCountA: a.run.recommendedActions.length,
    recommendedActionCountB: b.run.recommendedActions.length,
    completenessWarningsA: a.quality.completenessWarnings,
    completenessWarningsB: b.quality.completenessWarnings,
    qualityWarningsA: a.quality.qualityWarnings,
    qualityWarningsB: b.quality.qualityWarnings,
  };
}
