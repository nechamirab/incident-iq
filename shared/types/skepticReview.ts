import type { z } from 'zod';
import type { SkepticReviewSchema } from '../schemas/skepticReview.schema.js';

export type SkepticReview = z.infer<typeof SkepticReviewSchema>;
