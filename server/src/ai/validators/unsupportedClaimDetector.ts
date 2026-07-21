import type { AiFact } from '../schemas/aiAnalysisResponse.schema.js';

/**
 * Detects facts that are effectively unsupported: the schema requires
 * every fact to cite at least one evidence id, but if none of the ids it
 * cites actually belong to the incident (see
 * {@link findUnknownEvidenceReferences}), the fact has no real evidentiary
 * backing despite passing schema validation. Such facts are demoted --
 * their statement text is surfaced as an unsupported claim rather than
 * trusted as a fact.
 *
 * @param facts The AI response's `facts` array.
 * @param knownEvidenceIds The incident's real evidence item ids.
 * @returns The statement text of every fact with no valid evidence backing.
 */
export function detectUnsupportedFacts(
  facts: readonly AiFact[],
  knownEvidenceIds: ReadonlySet<string>,
): string[] {
  return facts
    .filter((fact) => !fact.evidenceIds.some((id) => knownEvidenceIds.has(id)))
    .map((fact) => fact.statement);
}
