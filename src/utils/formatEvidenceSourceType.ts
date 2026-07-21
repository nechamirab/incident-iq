import type { EvidenceSourceType } from '../../shared/types/evidence';

/** Renders an evidence source type as readable text, e.g. `"database error"`. */
export function formatEvidenceSourceType(sourceType: EvidenceSourceType): string {
  return sourceType.replace(/-/g, ' ');
}
