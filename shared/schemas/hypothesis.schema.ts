import { z } from 'zod';
import { ConfidenceScoreSchema, IdSchema, IsoDateTimeSchema } from './common.schema.js';

/**
 * Lifecycle of a root-cause hypothesis. The AI itself must never set a
 * hypothesis to `confirmed-by-human` — only an explicit human review action
 * may do so.
 */
export const HypothesisStatusSchema = z.enum([
  'proposed',
  'testing',
  'supported',
  'weakened',
  'rejected',
  'confirmed-by-human',
]);

/** A single candidate explanation for the incident, always falsifiable. */
export const HypothesisSchema = z.object({
  id: IdSchema,
  title: z.string().min(1, 'title must not be empty'),
  description: z.string(),
  confidence: ConfidenceScoreSchema,
  confidenceReason: z.string(),
  supportingEvidenceIds: z.array(IdSchema),
  contradictingEvidenceIds: z.array(IdSchema),
  assumptions: z.array(z.string()),
  recommendedTest: z.string(),
  expectedResult: z.string(),
  status: HypothesisStatusSchema,
  /** When a human last changed `status` via `PATCH .../hypotheses/:id/status`; `null`/absent while still at the AI-assigned `proposed` status. */
  reviewedAt: IsoDateTimeSchema.nullable().optional(),
  /** Optional free-text note a human reviewer recorded when changing `status`; `null`/absent if none was given. */
  humanReviewNote: z.string().nullable().optional(),
  /** `status` immediately before the most recent human review action; `null`/absent before any review has happened. */
  previousStatus: HypothesisStatusSchema.nullable().optional(),
});
