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
 * action note) produced during analysis.
 *
 * Evidence citation is category-aware, not uniform: a `fact` must cite at
 * least one evidence id -- a "fact" with zero evidence backing is a
 * contradiction in terms, and this is enforced here structurally (not just
 * at the AI-input boundary in `aiAnalysisResponse.schema.ts`) so *every*
 * write path, present or future, is held to the same rule. `assumption`,
 * `hypothesis`, and `action` may legitimately have zero evidence ids (an
 * assumption is by definition not yet evidence-backed) and are left
 * unconstrained.
 */
export const ReasoningItemSchema = z
  .object({
    id: IdSchema,
    category: ReasoningCategorySchema,
    statement: z.string().min(1, 'statement must not be empty'),
    explanation: z.string(),
    evidenceIds: z.array(IdSchema),
    confidence: ConfidenceScoreSchema,
    reviewStatus: ReviewStatusSchema,
  })
  .refine((item) => item.category !== 'fact' || item.evidenceIds.length > 0, {
    message: 'A fact must cite at least one evidence id.',
    path: ['evidenceIds'],
  });
