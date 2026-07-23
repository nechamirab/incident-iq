import type { AiAnalysisResponse } from './schemas/aiAnalysisResponse.schema.js';
import type { CompletionDeficiency } from './validators/analysisQualityEvaluator.js';

export interface CompletionRepairMergeResult {
  /** The final response to persist -- `original` with only the sections that genuinely improved replaced. */
  response: AiAnalysisResponse;
  /** Which sections were actually replaced (a targeted deficiency that the repair pass did not improve is not listed). */
  repairedSections: string[];
}

/**
 * Merges a targeted completion-repair response into the original,
 * validated analysis response -- deliberately field-by-field rather than
 * accepting the repaired response wholesale, so a repair pass can only
 * ever improve the specific sections it was asked to fix. `facts` and
 * `summary` are never taken from the repaired response under any
 * circumstance, satisfying the requirement that already-supported facts
 * are never altered by a completion-repair pass.
 *
 * A section is only adopted from the repair if it actually addresses the
 * deficiency it was asked to fix (e.g. `reasoningRisks` is only replaced
 * if the repaired version is non-empty) -- an ineffective repair leaves
 * the original section untouched rather than replacing it with an
 * equally-empty one, so `repairedSections` accurately reflects what, if
 * anything, actually improved.
 *
 * @param original The original, schema-valid response that triggered a repair.
 * @param repaired The schema-valid response returned by the completion-repair prompt.
 * @param deficiencies Which sections the repair prompt was asked to address.
 */
export function mergeCompletionRepair(
  original: AiAnalysisResponse,
  repaired: AiAnalysisResponse,
  deficiencies: readonly CompletionDeficiency[],
): CompletionRepairMergeResult {
  const response: AiAnalysisResponse = { ...original };
  const repairedSections: string[] = [];
  const targeted = new Set(deficiencies);

  if (targeted.has('empty-reasoning-risks') && repaired.reasoningRisks.length > 0) {
    response.reasoningRisks = repaired.reasoningRisks;
    repairedSections.push('reasoningRisks');
  }

  if (targeted.has('empty-recommended-actions') && repaired.recommendedActions.length > 0) {
    response.recommendedActions = repaired.recommendedActions;
    repairedSections.push('recommendedActions');
  }

  if (targeted.has('empty-open-questions') && repaired.openQuestions.length > 0) {
    response.openQuestions = repaired.openQuestions;
    repairedSections.push('openQuestions');
  }

  if (targeted.has('trivial-uncertainty-statement') && repaired.uncertaintyStatement.trim().length >= 15) {
    response.uncertaintyStatement = repaired.uncertaintyStatement;
    repairedSections.push('uncertaintyStatement');
  }

  if (targeted.has('all-hypotheses-missing-contradicting-evidence')) {
    const sameHypothesesShape =
      repaired.hypotheses.length === original.hypotheses.length &&
      repaired.hypotheses.every((h, index) => h.tempId === original.hypotheses[index]?.tempId);
    const gainedContradictingEvidenceOrExplanation = repaired.hypotheses.some(
      (h, index) =>
        h.contradictingEvidenceIds.length > 0 ||
        h.confidenceReason.length > (original.hypotheses[index]?.confidenceReason.length ?? 0),
    );
    if (sameHypothesesShape && gainedContradictingEvidenceOrExplanation) {
      response.hypotheses = repaired.hypotheses;
      repairedSections.push('hypotheses');
    }
  }

  return { response, repairedSections };
}
