import type { AiAnalysisResponse } from '../schemas/aiAnalysisResponse.schema.js';

/**
 * Scans every evidence id referenced anywhere in a validated AI response
 * (facts, assumptions, timeline, hypotheses, reasoning risks, and
 * recommended actions) and reports any id that does not belong to the
 * incident's actual evidence set -- i.e. a hallucinated citation. Schema
 * validation alone cannot catch this, since it only checks that
 * `evidenceIds` are strings, not that they refer to real evidence.
 *
 * Covers every `evidenceIds`-bearing field of an incident-analysis
 * response: facts, assumptions, timeline events, hypotheses (both
 * supporting and contradicting evidence), reasoning risks (bias findings),
 * and recommended actions. The skeptic-review and postmortem AI-facing
 * schemas have no `evidenceIds` fields of their own to validate here --
 * `AiSkepticReviewResponseSchema` deliberately omits `ignoredEvidenceIds`
 * (computed by the backend from the run being reviewed, never supplied by
 * the AI; see `mapSkepticReviewResponse.ts`), and the postmortem schema's
 * fields are free-form prose/string-array content, not evidence-id
 * references.
 *
 * @param response A schema-validated AI analysis response.
 * @param knownEvidenceIds The incident's real evidence item ids.
 * @returns Human-readable warning strings, one per unknown reference found
 * (empty if every reference is valid). Never throws, even if every
 * `evidenceIds` array is empty.
 */
export function findUnknownEvidenceReferences(
  response: AiAnalysisResponse,
  knownEvidenceIds: ReadonlySet<string>,
): string[] {
  const warnings: string[] = [];

  function check(evidenceIds: readonly string[], context: string): void {
    for (const id of evidenceIds) {
      if (!knownEvidenceIds.has(id)) {
        warnings.push(`${context} references unknown evidence id "${id}".`);
      }
    }
  }

  response.facts.forEach((fact, index) => check(fact.evidenceIds, `Fact #${index + 1}`));
  response.assumptions.forEach((item, index) => check(item.evidenceIds, `Assumption #${index + 1}`));
  response.timeline.forEach((event, index) => check(event.evidenceIds, `Timeline event #${index + 1}`));

  response.hypotheses.forEach((hypothesis) => {
    check(hypothesis.supportingEvidenceIds, `Hypothesis "${hypothesis.tempId}" (supporting)`);
    check(hypothesis.contradictingEvidenceIds, `Hypothesis "${hypothesis.tempId}" (contradicting)`);
  });

  response.reasoningRisks.forEach((risk, index) => check(risk.evidenceIds, `Reasoning risk #${index + 1}`));

  response.recommendedActions.forEach((action, index) =>
    check(action.evidenceIds, `Recommended action #${index + 1}`),
  );

  return warnings;
}
