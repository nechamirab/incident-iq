import type { Incident } from '../../../shared/types/incident.js';
import { buildIncidentAnalysisPrompt, INCIDENT_ANALYSIS_PROMPT_VERSION } from '../ai/prompts/incidentAnalysisV1.js';
import { buildIncidentAnalysisPromptV2, INCIDENT_ANALYSIS_V2_PROMPT_VERSION } from '../ai/prompts/incidentAnalysisV2.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { compareAnalysisRuns, type AnalysisRunComparison } from './compareAnalysisRuns.js';
import type { RealCallGateResult } from './realCallGate.js';
import { runAnalysisForExperiment, type AnalysisExperimentResult } from './runAnalysisForExperiment.js';
import type { AiProviderName } from '../../../shared/types/analysisRun.js';

export interface PromptComparisonMockCheck {
  incidentId: string;
  v1: AnalysisExperimentResult;
  v2: AnalysisExperimentResult;
  /** Always present: MockAIProvider ignores prompt text entirely (see MockAIProvider.complete's unused `_prompt` param), so this leg only proves the v1/v2 pipeline itself is schema-valid end to end -- it demonstrates nothing about how v1 and v2 differ. */
  note: string;
}

export interface PromptComparisonRealResult {
  status: 'ran';
  provider: AiProviderName;
  v1: AnalysisExperimentResult;
  v2: AnalysisExperimentResult;
  comparison: AnalysisRunComparison;
}

export interface PromptComparisonNotRun {
  status: 'not-run';
  reason: string;
}

export interface PromptComparisonExperimentResult {
  incidentId: string;
  /** Always executed (free, deterministic) -- proves the pipeline works, never a real prompt-quality finding. */
  mockPipelineCheck: PromptComparisonMockCheck;
  /** The actual v1-vs-v2 comparison; only meaningful once it has genuinely run against a real provider. */
  realComparison: PromptComparisonRealResult | PromptComparisonNotRun;
}

const MOCK_PIPELINE_NOTE =
  'MockAIProvider is deterministic and derives its response entirely from the incident\'s evidence, ' +
  'ignoring the prompt text (by design -- see MockAIProvider.complete). Running v1 and v2 through the ' +
  'mock provider therefore only confirms that both prompt versions still produce a schema-valid, ' +
  'well-formed AnalysisRun through the shared validation pipeline; it demonstrates nothing about how ' +
  'v1 and v2 actually differ. That comparison requires a real provider -- see "realComparison" below.';

/**
 * Experiment A: prompt comparison (v1 vs. v2). Always runs both prompt
 * versions against the mock provider first, purely to prove the framework
 * and shared validation pipeline work end to end for both prompt versions
 * -- explicitly labeled as not a real comparison (see
 * {@link MOCK_PIPELINE_NOTE}). The actual v1-vs-v2 comparison only runs
 * (and is only reported as such) if a real-provider attempt is supplied and
 * its {@link RealCallGateResult} allows it; otherwise `realComparison` is
 * honestly recorded as not-run, with the reason.
 */
export async function runPromptComparisonExperiment(params: {
  incident: Incident;
  mockProvider: AIProvider;
  realProviderAttempt?: { provider: AIProvider; gate: RealCallGateResult };
}): Promise<PromptComparisonExperimentResult> {
  const { incident, mockProvider, realProviderAttempt } = params;

  // Run sequentially, never concurrently, on the same provider instance: a
  // real provider (AnthropicAIProvider/OpenAIProvider) tracks per-call
  // metadata (redaction stats, request id, verified flag) in mutable
  // instance fields read immediately after each `complete()` resolves --
  // two concurrent calls on the same instance would race and could
  // attribute one call's metadata to the other.
  const mockV1 = await runAnalysisForExperiment(
    incident,
    mockProvider,
    buildIncidentAnalysisPrompt,
    INCIDENT_ANALYSIS_PROMPT_VERSION,
  );
  const mockV2 = await runAnalysisForExperiment(
    incident,
    mockProvider,
    buildIncidentAnalysisPromptV2,
    INCIDENT_ANALYSIS_V2_PROMPT_VERSION,
  );

  const mockPipelineCheck: PromptComparisonMockCheck = {
    incidentId: incident.id,
    v1: mockV1,
    v2: mockV2,
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
  const realV1 = await runAnalysisForExperiment(
    incident,
    provider,
    buildIncidentAnalysisPrompt,
    INCIDENT_ANALYSIS_PROMPT_VERSION,
  );
  const realV2 = await runAnalysisForExperiment(
    incident,
    provider,
    buildIncidentAnalysisPromptV2,
    INCIDENT_ANALYSIS_V2_PROMPT_VERSION,
  );

  return {
    incidentId: incident.id,
    mockPipelineCheck,
    realComparison: {
      status: 'ran',
      provider: provider.name,
      v1: realV1,
      v2: realV2,
      comparison: compareAnalysisRuns(
        incident.id,
        { label: 'v1', run: realV1.run, quality: realV1.quality },
        { label: 'v2', run: realV2.run, quality: realV2.quality },
      ),
    },
  };
}
