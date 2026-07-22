import { z } from 'zod';

/**
 * The JSON shape the AI provider (mock or real) must return for one
 * skeptic-review pass. Unlike `AiAnalysisResponseSchema`, this omits
 * `challengedHypothesisId` and `ignoredEvidenceIds` entirely: the backend
 * already knows which hypothesis is leading (highest confidence) and which
 * evidence ids the original run never cited, before it even builds the
 * prompt -- both are facts, not judgment calls, so the AI is asked only for
 * the qualitative critique and the backend supplies the rest itself in
 * `mapSkepticReviewResponse`, removing an entire class of possible
 * hallucination/mismatch.
 */
export const AiSkepticReviewResponseSchema = z.object({
  challengeSummary: z.string().min(1, 'challengeSummary must not be empty'),
  alternativeExplanations: z.array(z.string()),
  confirmationBiasAssessment: z.string().min(1, 'confirmationBiasAssessment must not be empty'),
  falsificationTest: z.string().min(1, 'falsificationTest must not be empty'),
  recommendedTests: z.array(z.string()),
  overallAssessment: z.string().min(1, 'overallAssessment must not be empty'),
});

export type AiSkepticReviewResponse = z.infer<typeof AiSkepticReviewResponseSchema>;
