import type { AiFact } from '../schemas/aiAnalysisResponse.schema.js';

/**
 * Detects facts that are effectively unsupported: the schema requires
 * every fact to cite at least one evidence id, but if none of the ids it
 * cites actually belong to the incident (see
 * {@link findUnknownEvidenceReferences}), the fact has no real evidentiary
 * backing despite passing schema validation.
 *
 * This is the single source of truth for "is this fact unsupported" --
 * {@link mapAiResponseToAnalysisRun} uses its result both to keep such
 * facts out of the persisted `facts` collection and to populate
 * `unsupportedClaims`, so a fact can never simultaneously appear as a
 * verified fact and as an unsupported claim.
 *
 * @param facts The AI response's `facts` array.
 * @param knownEvidenceIds The incident's real evidence item ids.
 * @returns The (same-reference) subset of `facts` with no valid evidence backing.
 */
export function detectUnsupportedFacts(
  facts: readonly AiFact[],
  knownEvidenceIds: ReadonlySet<string>,
): AiFact[] {
  return facts.filter((fact) => !fact.evidenceIds.some((id) => knownEvidenceIds.has(id)));
}
