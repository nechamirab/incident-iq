import type { EvidenceItem } from '../../shared/types/evidence';
import { EVIDENCE_TYPE_FILTER_ALL, type EvidenceTypeFilter } from '../store/workspaceStore';

export interface EvidenceFilterOptions {
  search: string;
  sourceType: EvidenceTypeFilter;
}

/**
 * Filters an incident's evidence by free-text search (matched against the
 * source name and normalized content, case-insensitively) and/or source
 * type. Pure and easily testable independent of any UI.
 */
export function filterEvidence(
  evidence: readonly EvidenceItem[],
  { search, sourceType }: EvidenceFilterOptions,
): EvidenceItem[] {
  const normalizedSearch = search.trim().toLowerCase();

  return evidence.filter((item) => {
    if (sourceType !== EVIDENCE_TYPE_FILTER_ALL && item.sourceType !== sourceType) {
      return false;
    }

    if (normalizedSearch.length === 0) {
      return true;
    }

    return (
      item.sourceName.toLowerCase().includes(normalizedSearch) ||
      item.normalizedContent.toLowerCase().includes(normalizedSearch) ||
      item.id.toLowerCase().includes(normalizedSearch)
    );
  });
}
