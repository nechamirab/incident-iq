import { z } from 'zod';
import { ConfidenceScoreSchema, IdSchema } from './common.schema.js';

/**
 * The four categories every AI-generated (or human) statement must be
 * sorted into. These must never be mixed: a hypothesis is never presented
 * as a fact, and an assumption is never presented as confirmed.
 */
export const ReasoningCategorySchema = z.enum(['fact', 'assumption', 'hypothesis', 'action']);

/** Human-reviewer judgment on whether a statement holds up under scrutiny. */
export const ReviewStatusSchema = z.enum([
  'unreviewed',
  'supported',
  'partially-supported',
  'unsupported',
  'rejected',
]);

/**
 * A single categorized statement (fact, assumption, hypothesis summary, or
 * action note) produced during analysis, always traceable to evidence.
 */
export const ReasoningItemSchema = z.object({
  id: IdSchema,
  category: ReasoningCategorySchema,
  statement: z.string().min(1, 'statement must not be empty'),
  explanation: z.string(),
  evidenceIds: z.array(IdSchema),
  confidence: ConfidenceScoreSchema,
  reviewStatus: ReviewStatusSchema,
});
