import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common.schema.js';
import { AiProviderNameSchema } from './analysisRun.schema.js';

/**
 * A skeptic's critique of one analysis run's leading hypothesis: alternative
 * explanations, evidence the original analysis never cited, an assessment of
 * confirmation-bias risk, what would falsify the leading hypothesis, and
 * additional recommended tests.
 *
 * Saved as a separate result linked to the `AnalysisRun` it reviews (via
 * `analysisRunId`) -- it never overwrites or modifies the original analysis.
 * `challengedHypothesisId` and `ignoredEvidenceIds` are always computed by
 * the backend from the run being reviewed, never trusted from the AI's own
 * response, since both are facts the backend can determine with certainty.
 */
export const SkepticReviewSchema = z.object({
  id: IdSchema,
  incidentId: IdSchema,
  analysisRunId: IdSchema,
  provider: AiProviderNameSchema,
  model: z.string().min(1, 'model must not be empty'),
  promptVersion: z.string().min(1, 'promptVersion must not be empty'),
  createdAt: IsoDateTimeSchema,
  durationMs: z.number().nonnegative(),
  /** What `AI_PROVIDER` was actually configured to when this review was produced; see `AnalysisRunSchema`'s matching field. */
  configuredProvider: AiProviderNameSchema.optional(),
  fallbackUsed: z.boolean().optional(),
  fallbackReason: z.string().nullable().optional(),
  challengedHypothesisId: IdSchema,
  challengeSummary: z.string().min(1, 'challengeSummary must not be empty'),
  alternativeExplanations: z.array(z.string()),
  ignoredEvidenceIds: z.array(z.string()),
  confirmationBiasAssessment: z.string().min(1, 'confirmationBiasAssessment must not be empty'),
  falsificationTest: z.string().min(1, 'falsificationTest must not be empty'),
  recommendedTests: z.array(z.string()),
  overallAssessment: z.string().min(1, 'overallAssessment must not be empty'),
  humanNotes: z.string().nullable(),
  rawResponse: z.unknown(),
});
