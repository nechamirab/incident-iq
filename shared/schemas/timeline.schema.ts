import { z } from 'zod';
import { ConfidenceScoreSchema, IdSchema, IsoDateTimeSchema } from './common.schema.js';

/**
 * How trustworthy a timeline event's timestamp is. `inferred` and
 * `unknown` events must always be visually distinguished from `exact` ones
 * in the UI, never presented with equal certainty.
 */
export const TimestampTypeSchema = z.enum(['exact', 'approximate', 'inferred', 'unknown']);

/** A single reconstructed event in the incident timeline. */
export const TimelineEventSchema = z.object({
  id: IdSchema,
  timestamp: IsoDateTimeSchema,
  title: z.string().min(1, 'title must not be empty'),
  description: z.string(),
  evidenceIds: z.array(IdSchema),
  timestampType: TimestampTypeSchema,
  confidence: ConfidenceScoreSchema,
  isInferred: z.boolean(),
});
