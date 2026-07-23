import type { AiProviderName } from '../../../shared/types/analysisRun.js';
import type { Incident } from '../../../shared/types/incident.js';
import { buildIncidentAnalysisPromptV2, INCIDENT_ANALYSIS_V2_PROMPT_VERSION } from '../ai/prompts/incidentAnalysisV2.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { compareAnalysisRuns, type AnalysisRunComparison } from './compareAnalysisRuns.js';
import {
  ARGUE_AGAINST_FIRST_CAUSE_VARIANT_VERSION,
  buildArgueAgainstFirstCausePrompt,
} from './promptSensitivityVariant.js';
import type { RealCallGateResult } from './realCallGate.js';
import { runAnalysisForExperiment, type AnalysisExperimentResult } from './runAnalysisForExperiment.js';

export interface PromptSensitivityMockCheck {
  incidentId: string;
  standard: AnalysisExperimentResult;
  variant: AnalysisExperimentResult;
  /** Always present -- see `promptComparisonExperiment.ts`'s identical caveat about MockAIProvider ignoring prompt text. */
  note: string;
}

export interface PromptSensitivityRealResult {
  status: 'ran';
  provider: AiProviderName;
  standard: AnalysisExperimentResult;
  variant: AnalysisExperimentResult;
  comparison: AnalysisRunComparison;
}

export interface PromptSensitivityNotRun {
  status: 'not-run';
  reason: string;
}

export interface PromptSensitivityExperimentResult {
  incidentId: string;
  mockPipelineCheck: PromptSensitivityMockCheck;
  realComparison: PromptSensitivityRealResult | PromptSensitivityNotRun;
}

const MOCK_PIPELINE_NOTE =
  'MockAIProvider ignores prompt text entirely (see MockAIProvider.complete), so it cannot meaningfully ' +
  'demonstrate prompt sensitivity. This leg only confirms the "argue against the first apparent cause" ' +
  'variant still produces a schema-valid AnalysisRun through the shared validation pipeline. The actual ' +
  'sensitivity comparison requires a real provider -- see "realComparison" below.';

/**
 * Experiment C: prompt sensitivity. Compares the standard `incident-analysis-v2`
 * prompt against a variant that adds one instruction -- deliberately argue
 * against the most obvious apparent cause (see `promptSensitivityVariant.ts`)
 * -- on the same evidence, to see whether that single instruction changes
 * the leading hypothesis, its confidence, or how much contradicting
 * evidence gets surfaced. Same mock-pipeline-check-first, real-comparison-
 * gated structure as {@link import('./promptComparisonExperiment.js').runPromptComparisonExperiment}.
 */
export async function runPromptSensitivityExperiment(params: {
  incident: Incident;
  mockProvider: AIProvider;
  realProviderAttempt?: { provider: AIProvider; gate: RealCallGateResult };
}): Promise<PromptSensitivityExperimentResult> {
  const { incident, mockProvider, realProviderAttempt } = params;

  const mockStandard = await runAnalysisForExperiment(
    incident,
    mockProvider,
    buildIncidentAnalysisPromptV2,
    INCIDENT_ANALYSIS_V2_PROMPT_VERSION,
  );
  const mockVariant = await runAnalysisForExperiment(
    incident,
    mockProvider,
    buildArgueAgainstFirstCausePrompt,
    ARGUE_AGAINST_FIRST_CAUSE_VARIANT_VERSION,
  );

  const mockPipelineCheck: PromptSensitivityMockCheck = {
    incidentId: incident.id,
    standard: mockStandard,
    variant: mockVariant,
    note: MOCK_PIPELINE_NOTE,
  };

  if (!realProviderAttempt) {
    return {
      incidentId: incident.id,
      mockPipelineCheck,
      realComparison: { status: 'not-run', reason: 'No real provider was configured for this experiment run.' },
    };
  }

  if (!realProviderAttempt.gate.allowed) {
    return {
      incidentId: incident.id,
      mockPipelineCheck,
      realComparison: { status: 'not-run', reason: realProviderAttempt.gate.reason },
    };
  }

  const { provider } = realProviderAttempt;
  const realStandard = await runAnalysisForExperiment(
    incident,
    provider,
    buildIncidentAnalysisPromptV2,
    INCIDENT_ANALYSIS_V2_PROMPT_VERSION,
  );
  const realVariant = await runAnalysisForExperiment(
    incident,
    provider,
    buildArgueAgainstFirstCausePrompt,
    ARGUE_AGAINST_FIRST_CAUSE_VARIANT_VERSION,
  );

  return {
    incidentId: incident.id,
    mockPipelineCheck,
    realComparison: {
      status: 'ran',
      provider: provider.name,
      standard: realStandard,
      variant: realVariant,
      comparison: compareAnalysisRuns(
        incident.id,
        { label: 'standard', run: realStandard.run, quality: realStandard.quality },
        { label: 'argue-against-variant', run: realVariant.run, quality: realVariant.quality },
      ),
    },
  };
}
