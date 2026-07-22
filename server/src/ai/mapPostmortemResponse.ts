import type { AiProviderName } from '../../../shared/types/analysisRun.js';
import type { Postmortem } from '../../../shared/types/postmortem.js';
import type { AiPostmortemResponse } from './schemas/postmortemResponse.schema.js';

export interface MapPostmortemResponseParams {
  response: AiPostmortemResponse;
  providerName: AiProviderName;
  model: string;
  promptVersion: string;
}

/**
 * Converts a schema-validated {@link AiPostmortemResponse} into a persisted
 * {@link Postmortem}: attaches provenance the AI never supplies itself
 * (`provider`/`model`/`promptVersion`/`generatedAt`), and always starts
 * `lastEditedAt` at `null` -- a freshly (re)generated draft has not yet
 * been edited by a human, even if a previous draft had been.
 */
export function mapAiResponseToPostmortem(params: MapPostmortemResponseParams): Postmortem {
  const { response, providerName, model, promptVersion } = params;

  return {
    ...response,
    provider: providerName,
    model,
    promptVersion,
    generatedAt: new Date().toISOString(),
    lastEditedAt: null,
  };
}
