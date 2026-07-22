import { z } from 'zod';

/** Request body for `PATCH /api/incidents/:incidentId/skeptic-reviews/:reviewId/notes`. */
export const SkepticReviewNotesRequestSchema = z.object({
  humanNotes: z.string(),
});

export type SkepticReviewNotesRequest = z.infer<typeof SkepticReviewNotesRequestSchema>;
