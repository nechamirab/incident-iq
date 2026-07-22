import { z } from 'zod';
import { PostmortemSchema } from '../../../shared/schemas/postmortem.schema.js';

/**
 * Request body for `PATCH /api/incidents/:incidentId/postmortem`: any
 * subset of the postmortem's content fields, never its system-managed
 * provenance fields (`provider`/`model`/`promptVersion`/`generatedAt`/
 * `lastEditedAt`), which only `postmortemService` itself may set.
 */
export const PostmortemEditRequestSchema = PostmortemSchema.omit({
  provider: true,
  model: true,
  promptVersion: true,
  generatedAt: true,
  lastEditedAt: true,
}).partial();

export type PostmortemEditRequest = z.infer<typeof PostmortemEditRequestSchema>;
