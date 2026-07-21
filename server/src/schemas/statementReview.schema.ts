import { z } from 'zod';
import { ReviewStatusSchema } from '../../../shared/schemas/reasoning.schema.js';

/** Request body for `PATCH /api/incidents/:incidentId/statements/:statementId/review`. */
export const StatementReviewRequestSchema = z.object({
  reviewStatus: ReviewStatusSchema,
});

export type StatementReviewRequest = z.infer<typeof StatementReviewRequestSchema>;
