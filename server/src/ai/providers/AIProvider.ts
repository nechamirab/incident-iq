import type { Incident } from '../../../../shared/types/incident.js';
import type { AiProviderName } from '../../../../shared/types/analysisRun.js';

/** A system/user prompt pair, as sent to a chat-completion style model. */
export interface AIPrompt {
  system: string;
  user: string;
}

/**
 * Provider-agnostic contract for anything that can produce an incident
 * analysis. `analysisService` (the only caller) depends solely on this
 * interface, never on a concrete provider, so switching `AI_PROVIDER` never
 * requires changing business logic or the UI.
 *
 * `incident` is passed alongside the already-built `prompt` so a mock
 * implementation can generate a deterministic response directly from the
 * incident's evidence, without needing to parse it back out of prompt text.
 * A real provider ignores `incident` and only sends `prompt` to the model.
 */
export interface AIProvider {
  readonly name: AiProviderName;
  readonly model: string;

  /**
   * Requests one completion from the model and returns its raw text
   * response, unparsed and unvalidated -- the caller is responsible for
   * extracting and validating JSON from it.
   */
  complete(incident: Incident, prompt: AIPrompt): Promise<string>;
}
