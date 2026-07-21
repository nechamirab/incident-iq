import type { z } from 'zod';
import type {
  ActionCategorySchema,
  ActionPrioritySchema,
  ActionStatusSchema,
  RecommendedActionSchema,
} from '../schemas/action.schema.js';

export type ActionPriority = z.infer<typeof ActionPrioritySchema>;
export type ActionCategory = z.infer<typeof ActionCategorySchema>;
export type ActionStatus = z.infer<typeof ActionStatusSchema>;
export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;
