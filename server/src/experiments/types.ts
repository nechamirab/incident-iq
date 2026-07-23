import type { AiProviderName } from '../../../shared/types/analysisRun.js';

/**
 * Safe, sanitized metadata recorded for every provider call the experiment
 * framework makes -- deliberately mirrors the fields already exposed on
 * {@link import('../ai/providers/AIProvider.js').AIProvider}, since that is
 * exactly what "real, verified" vs. "mock" means elsewhere in this codebase.
 * Never includes an API key, raw request/response payload, or any other
 * secret value.
 */
export interface ExperimentCallMetadata {
  providerUsed: AiProviderName;
  configuredProvider: AiProviderName;
  fallbackUsed: boolean;
  model: string;
  promptVersion: string;
  durationMs: number;
  redactionApplied: boolean;
  redactedValueCount: number;
  redactionCategories: readonly string[];
  /** Whether this call actually reached a real provider and got a real response back (mirrors {@link AIProvider.providerVerified}). `null` for the mock provider, for which verification is not a meaningful concept. */
  providerVerified: boolean | null;
}

/** Records that an experiment leg requiring a real provider was intentionally skipped, and exactly why -- never silently omitted, and never replaced with invented output. */
export interface NotRunLeg {
  status: 'not-run';
  provider: AiProviderName;
  reason: string;
}

/** One experiment leg that did produce real output (mock or a real provider). */
export interface RanLeg<TResult> {
  status: 'ran';
  provider: AiProviderName;
  metadata: ExperimentCallMetadata;
  result: TResult;
}

export type ExperimentLeg<TResult> = RanLeg<TResult> | NotRunLeg;

export function isRanLeg<TResult>(leg: ExperimentLeg<TResult>): leg is RanLeg<TResult> {
  return leg.status === 'ran';
}
