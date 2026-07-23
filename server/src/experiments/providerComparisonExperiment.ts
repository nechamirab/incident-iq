import type { Incident } from '../../../shared/types/incident.js';
import { buildIncidentAnalysisPromptV2, INCIDENT_ANALYSIS_V2_PROMPT_VERSION } from '../ai/prompts/incidentAnalysisV2.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { compareAnalysisRuns, type AnalysisRunComparison } from './compareAnalysisRuns.js';
import type { RealCallGateResult } from './realCallGate.js';
import { runAnalysisForExperiment, type AnalysisExperimentResult } from './runAnalysisForExperiment.js';
import type { ExperimentLeg } from './types.js';

/** One real provider considered for Experiment B, and whether the safety gate allows calling it. */
export interface RealProviderAttempt {
  provider: AIProvider;
  gate: RealCallGateResult;
}

export interface ProviderComparisonExperimentResult {
  incidentId: string;
  promptVersion: string;
  mockLeg: ExperimentLeg<AnalysisExperimentResult>;
  realLegs: ExperimentLeg<AnalysisExperimentResult>[];
  /** Mock-vs-real comparisons, one per real leg that actually ran. Empty when no real leg ran. */
  comparisons: AnalysisRunComparison[];
}

/**
 * Experiment B: provider comparison. Always runs the mock provider (free,
 * deterministic); runs each supplied real provider only if its
 * {@link RealCallGateResult} allows it (see `realCallGate.ts`) -- otherwise
 * records why it did not run rather than inventing or omitting that leg.
 * Architecture support for a provider is never treated as equivalent to an
 * actual comparison: `comparisons` only ever contains entries for real legs
 * that genuinely executed and returned a real, schema-valid response.
 *
 * Uses the current production prompt (v2) for both legs, since this
 * experiment isolates the *provider* as the variable under test, not the
 * prompt.
 */
export async function runProviderComparisonExperiment(params: {
  incident: Incident;
  mockProvider: AIProvider;
  realProviderAttempts: RealProviderAttempt[];
}): Promise<ProviderComparisonExperimentResult> {
  const { incident, mockProvider, realProviderAttempts } = params;

  const mockResult = await runAnalysisForExperiment(
    incident,
    mockProvider,
    buildIncidentAnalysisPromptV2,
    INCIDENT_ANALYSIS_V2_PROMPT_VERSION,
  );
  const mockLeg: ExperimentLeg<AnalysisExperimentResult> = {
    status: 'ran',
    provider: mockProvider.name,
    metadata: mockResult.metadata,
    result: mockResult,
  };

  const realLegs: ExperimentLeg<AnalysisExperimentResult>[] = [];
  const comparisons: AnalysisRunComparison[] = [];

  for (const attempt of realProviderAttempts) {
    if (!attempt.gate.allowed) {
      realLegs.push({ status: 'not-run', provider: attempt.provider.name, reason: attempt.gate.reason });
      continue;
    }

    const realResult = await runAnalysisForExperiment(
      incident,
      attempt.provider,
      buildIncidentAnalysisPromptV2,
      INCIDENT_ANALYSIS_V2_PROMPT_VERSION,
    );
    realLegs.push({
      status: 'ran',
      provider: attempt.provider.name,
      metadata: realResult.metadata,
      result: realResult,
    });
    comparisons.push(
      compareAnalysisRuns(
        incident.id,
        { label: 'mock', run: mockResult.run, quality: mockResult.quality },
        { label: attempt.provider.name, run: realResult.run, quality: realResult.quality },
      ),
    );
  }

  return {
    incidentId: incident.id,
    promptVersion: INCIDENT_ANALYSIS_V2_PROMPT_VERSION,
    mockLeg,
    realLegs,
    comparisons,
  };
}
