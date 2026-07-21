import type { AnalysisRun } from '../../shared/types/analysisRun';

export type EvidenceReferenceType =
  | 'fact'
  | 'assumption'
  | 'hypothesis'
  | 'timeline event'
  | 'reasoning risk'
  | 'recommended action';

export interface EvidenceReference {
  type: EvidenceReferenceType;
  label: string;
}

/** Maps each evidence id to the claims (from one analysis run) that cite it. */
export type EvidenceReferenceIndex = ReadonlyMap<string, EvidenceReference[]>;

function addReference(
  index: Map<string, EvidenceReference[]>,
  evidenceIds: readonly string[],
  reference: EvidenceReference,
): void {
  for (const evidenceId of evidenceIds) {
    const existing = index.get(evidenceId);
    if (existing) {
      existing.push(reference);
    } else {
      index.set(evidenceId, [reference]);
    }
  }
}

/**
 * Builds a reverse index from evidence id to every claim in an analysis
 * run that cites it, so the Evidence browser can show "referenced by 2
 * facts, 1 hypothesis" against each piece of evidence.
 *
 * @param analysisRun The analysis run to index (typically the latest one).
 */
export function buildEvidenceReferenceIndex(analysisRun: AnalysisRun): EvidenceReferenceIndex {
  const index = new Map<string, EvidenceReference[]>();

  analysisRun.facts.forEach((fact, position) => {
    addReference(index, fact.evidenceIds, { type: 'fact', label: `Fact #${position + 1}` });
  });

  analysisRun.assumptions.forEach((assumption, position) => {
    addReference(index, assumption.evidenceIds, {
      type: 'assumption',
      label: `Assumption #${position + 1}`,
    });
  });

  analysisRun.timeline.forEach((event) => {
    addReference(index, event.evidenceIds, { type: 'timeline event', label: event.title });
  });

  analysisRun.hypotheses.forEach((hypothesis) => {
    addReference(index, hypothesis.supportingEvidenceIds, {
      type: 'hypothesis',
      label: `${hypothesis.title} (supporting)`,
    });
    addReference(index, hypothesis.contradictingEvidenceIds, {
      type: 'hypothesis',
      label: `${hypothesis.title} (contradicting)`,
    });
  });

  analysisRun.reasoningRisks.forEach((risk) => {
    addReference(index, risk.evidenceIds, { type: 'reasoning risk', label: risk.title });
  });

  analysisRun.recommendedActions.forEach((action) => {
    addReference(index, action.evidenceIds, { type: 'recommended action', label: action.title });
  });

  return index;
}

/** Summarizes a list of references as e.g. "2 facts, 1 hypothesis". */
export function summarizeEvidenceReferences(references: EvidenceReference[]): string {
  const countByType = new Map<EvidenceReferenceType, number>();
  for (const reference of references) {
    countByType.set(reference.type, (countByType.get(reference.type) ?? 0) + 1);
  }

  return Array.from(countByType.entries())
    .map(([type, count]) => `${count} ${type}${count === 1 ? '' : 's'}`)
    .join(', ');
}
