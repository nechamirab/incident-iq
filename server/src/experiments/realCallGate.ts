/**
 * Decides whether the critical-AI-experiment framework (`npm run
 * ai:experiment`) may make a real, billable call to a real provider
 * (OpenAI/Anthropic). Pure and independent of `process.env`/CLI parsing/any
 * provider SDK, so every gating scenario is directly unit-testable.
 *
 * Every condition below is required simultaneously -- there is no way to
 * make a real call by satisfying only some of them:
 * - `--real` (or equivalent) was explicitly passed on the command line.
 * - `RUN_REAL_AI_EXPERIMENTS=true` is set in the environment.
 * - An API key is actually configured for the requested provider.
 * - The call was explicitly approved (`--yes`, or an interactive y/N
 *   confirmation the caller already obtained).
 */
export interface RealCallGateInput {
  /** Whether real-provider calls were requested at all (e.g. `--real` on the CLI). */
  requested: boolean;
  /** Whether `RUN_REAL_AI_EXPERIMENTS` is set to exactly `"true"`. */
  runRealAiExperimentsEnabled: boolean;
  /** Whether an API key is configured for the specific provider being requested. */
  apiKeyConfigured: boolean;
  /** Whether the call has been explicitly approved (`--yes`, or an interactive confirmation). */
  approved: boolean;
}

export type RealCallGateResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * @param input The conditions relevant to allowing one real provider call.
 * @returns Whether the call may proceed, and why not if it may not.
 */
export function evaluateRealCallGate(input: RealCallGateInput): RealCallGateResult {
  if (!input.requested) {
    return {
      allowed: false,
      reason: 'Real-provider calls were not requested (pass --real to attempt them); using mock-only results.',
    };
  }
  if (!input.runRealAiExperimentsEnabled) {
    return {
      allowed: false,
      reason:
        'RUN_REAL_AI_EXPERIMENTS is not set to "true"; refusing to make a real, billable provider call.',
    };
  }
  if (!input.apiKeyConfigured) {
    return {
      allowed: false,
      reason: 'No API key is configured for the requested provider; refusing to make a real provider call.',
    };
  }
  if (!input.approved) {
    return {
      allowed: false,
      reason:
        'Real provider calls were not explicitly approved (pass --yes, or confirm interactively when prompted).',
    };
  }
  return { allowed: true };
}
