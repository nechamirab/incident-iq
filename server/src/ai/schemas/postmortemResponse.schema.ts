import type { z } from 'zod';
import { PostmortemSchema } from '../../../../shared/schemas/postmortem.schema.js';

/**
 * The JSON shape the AI provider (mock or real) must return for one
 * postmortem-draft pass. Derived from the persisted `PostmortemSchema` by
 * omitting every system-managed provenance field (`provider`, `model`,
 * `promptVersion`, `generatedAt`, `lastEditedAt`) -- the AI drafts only the
 * document's content; `mapAiResponseToPostmortem` attaches provenance
 * itself once the response is validated, the same principle already
 * applied to skeptic reviews.
 */
export const AiPostmortemResponseSchema = PostmortemSchema.omit({
  provider: true,
  model: true,
  promptVersion: true,
  generatedAt: true,
  lastEditedAt: true,
});

export type AiPostmortemResponse = z.infer<typeof AiPostmortemResponseSchema>;
