import type { AnalysisRun } from '../../shared/types/analysisRun';

export interface AnalysisRunSummaryRow {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  promptVersion: string;
  hypothesisCount: number;
  topConfidence: number | null;
}

/**
 * Builds a compact per-run summary row for the AI Review tab's run
 * comparison table, in the same order as `incident.analysisRuns` (oldest
 * first, since runs are appended in order).
 */
export function summarizeAnalysisRuns(runs: readonly AnalysisRun[]): AnalysisRunSummaryRow[] {
  return runs.map((run) => ({
    id: run.id,
    createdAt: run.createdAt,
    provider: run.provider,
    model: run.model,
    promptVersion: run.promptVersion,
    hypothesisCount: run.hypotheses.length,
    topConfidence:
      run.hypotheses.length === 0 ? null : Math.max(...run.hypotheses.map((h) => h.confidence)),
  }));
}
