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
 * analysis or review. `analysisService`/`skepticReviewService` (the only
 * callers) depend solely on this interface, never on a concrete provider,
 * so switching `AI_PROVIDER` never requires changing business logic or the
 * UI.
 *
 * `incident` is passed alongside the already-built `prompt` so a mock
 * implementation can generate a deterministic response directly from the
 * incident's evidence, without needing to parse it back out of prompt text.
 * A real provider ignores `incident`/`context` and only sends `prompt` to
 * the model.
 */
export interface AIProvider {
  readonly name: AiProviderName;
  readonly model: string;

  /**
   * Requests one completion from the model and returns its raw text
   * response, unparsed and unvalidated -- the caller is responsible for
   * extracting and validating JSON from it.
   */
  complete(incident: Incident, prompt: AIPrompt, context?: AICompletionContext): Promise<string>;
}
