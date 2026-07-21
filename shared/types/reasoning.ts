import type { z } from 'zod';
import type {
  ReasoningCategorySchema,
  ReasoningItemSchema,
  ReviewStatusSchema,
} from '../schemas/reasoning.schema.js';

export type ReasoningCategory = z.infer<typeof ReasoningCategorySchema>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type ReasoningItem = z.infer<typeof ReasoningItemSchema>;
