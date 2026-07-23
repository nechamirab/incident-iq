import type { AnalysisRun } from '../../../../shared/types/analysisRun.js';
import type { Incident } from '../../../../shared/types/incident.js';
import type { AiProviderName } from '../../../../shared/types/analysisRun.js';

/** A system/user prompt pair, as sent to a chat-completion style model. */
export interface AIPrompt {
  system: string;
  user: string;
}

/**
 * Extra structured data some prompts need beyond the incident itself, so a
 * mock implementation can generate a deterministic response without parsing
 * it back out of prompt text. A real provider ignores this entirely -- it
 * only sends `prompt` to the model, which already embeds everything a real
 * model needs in natural language.
 *
 * `kind` discriminates which non-default request this is (omitted entirely
 * for the main incident-analysis request); `analysisRun` is the run the
 * request is about in both cases -- the one being critiqued for a skeptic
 * review, or the one being summarized for a postmortem draft.
 */
export type AICompletionContext =
  | { kind: 'skeptic-review'; analysisRun: AnalysisRun }
  | { kind: 'postmortem'; analysisRun: AnalysisRun };

/**
 * Provider-agnostic contract for anything that can produce an incident
 * analysis or review. `analysisService`/`skepticReviewService`/
 * `postmortemService` (the only callers) depend solely on this interface,
 * never on a concrete provider, so switching `AI_PROVIDER` never requires
 * changing business logic or the UI -- and never requires a second,
 * feature-specific way to pick a provider.
 *
 * `incident` is passed alongside the already-built `prompt` so a mock
 * implementation can generate a deterministic response directly from the
 * incident's evidence, without needing to parse it back out of prompt text.
 * A real provider ignores `incident`/`context` and only sends `prompt` to
 * the model.
 */
export interface AIProvider {
  /** The provider that actually produces `complete()`'s output (never spoofed -- `mock` always means mock, even when serving as a fallback for a misconfigured `anthropic` setup). */
  readonly name: AiProviderName;
  readonly model: string;

  /** What `AI_PROVIDER` was actually set to when this instance was created -- see `createAIProvider`/`resolveProviderSelection`. Differs from `name` only when this instance is a mock fallback. */
  readonly configuredProvider: AiProviderName;
  /** Whether this instance exists because the configured provider could not be used and `ALLOW_MOCK_FALLBACK=true` permitted substituting the mock provider instead. */
  readonly fallbackUsed: boolean;
  /** Human-readable explanation of why fallback occurred; `null` when `fallbackUsed` is `false`. */
  readonly fallbackReason: string | null;
  /**
   * Whether a real request to this provider has succeeded at least once
   * during this process's lifetime -- `null` when verification isn't a
   * meaningful concept for this provider (the mock provider never talks to
   * an external API, so there is nothing to verify). A configured API key
   * is not the same claim as a *verified* one; this only becomes `true`
   * after an actual successful call, never merely because a key is present.
   */
  readonly providerVerified: boolean | null;
  /**
   * A safe, provider-issued identifier for the most recent completed
   * request (e.g. OpenAI's `x-request-id`), useful for debugging a specific
   * call with the provider's own support/logs -- never an auth header or
   * any other secret. `null` when the provider doesn't expose one (mock;
   * currently also Anthropic, which this codebase doesn't yet extract a
   * request id from) or before any request has completed.
   */
  readonly providerRequestId: string | null;
  /**
   * Whether the most recent request redacted anything from the prompt
   * before sending it externally (see `redactSensitiveContent.ts`). Always
   * `false` for the mock provider, which never sends anything externally
   * and may use the original synthetic evidence as-is -- this field is
   * itself part of what "clearly distinguishes external vs. local
   * behavior" between providers.
   */
  readonly redactionApplied: boolean;
  /** How many individual values were redacted from the most recent request's prompt; `0` if none (including for the mock provider, always). */
  readonly redactedValueCount: number;
  /** Which redaction categories (e.g. `"email"`, `"api-key"`) were found in the most recent request's prompt; `[]` if none. Never includes the redacted values themselves. */
  readonly redactionCategories: readonly string[];

  /**
   * Requests one completion from the model and returns its raw text
   * response, unparsed and unvalidated -- the caller is responsible for
   * extracting and validating JSON from it.
   */
  complete(incident: Incident, prompt: AIPrompt, context?: AICompletionContext): Promise<string>;
}
