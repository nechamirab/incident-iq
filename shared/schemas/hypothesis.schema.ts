import { z } from 'zod';
import { ConfidenceScoreSchema, IdSchema } from './common.schema.js';

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
});
