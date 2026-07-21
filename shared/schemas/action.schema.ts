import { z } from 'zod';
import { IdSchema } from './common.schema.js';

export const ActionPrioritySchema = z.enum(['immediate', 'high', 'medium', 'low']);

export const ActionCategorySchema = z.enum([
  'inspect',
  'reproduce',
  'compare',
  'rollback',
  'monitor',
  'communicate',
  'collect-evidence',
  'configuration-check',
  'code-review',
  'database-check',
]);

/** Human-tracked lifecycle of a recommended action. */
export const ActionStatusSchema = z.enum(['suggested', 'in-progress', 'completed', 'dismissed']);

/**
 * A concrete, evidence-linked next step. Recommended actions must never be
 * generic ("check the logs") — they must name a specific system, time
 * window, or comparison.
 */
export const RecommendedActionSchema = z.object({
  id: IdSchema,
  title: z.string().min(1, 'title must not be empty'),
  description: z.string(),
  priority: ActionPrioritySchema,
  category: ActionCategorySchema,
  relatedHypothesisIds: z.array(IdSchema),
  evidenceIds: z.array(IdSchema),
  expectedOutcome: z.string(),
  risk: z.string(),
  status: ActionStatusSchema,
});
