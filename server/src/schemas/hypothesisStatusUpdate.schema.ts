import { z } from 'zod';
import { HypothesisStatusSchema } from '../../../shared/schemas/hypothesis.schema.js';

/**
 * Request body for `PATCH /api/incidents/:incidentId/hypotheses/:hypothesisId/status`.
 *
 * Setting `status` to `"confirmed-by-human"` additionally requires
 * `confirmed: true` in the same request -- a deliberate, backend-enforced
 * safeguard (not just a frontend dialog) so that marking a hypothesis as
 * human-verified always requires an explicit, unambiguous signal from the
 * caller, never a value that could arrive as a side effect of a more
 * generic status update.
 */
export const HypothesisStatusUpdateRequestSchema = z
  .object({
    status: HypothesisStatusSchema,
    /** Optional free-text note explaining the reviewer's judgment. */
    humanReviewNote: z.string().nullable().optional(),
    /** Required (and must be `true`) when `status` is `"confirmed-by-human"`; ignored for any other status. */
    confirmed: z.boolean().optional(),
  })
  .refine((data) => data.status !== 'confirmed-by-human' || data.confirmed === true, {
    message: 'Confirming a hypothesis as human-verified requires "confirmed": true in the request body.',
    path: ['confirmed'],
  });

export type HypothesisStatusUpdateRequest = z.infer<typeof HypothesisStatusUpdateRequestSchema>;
