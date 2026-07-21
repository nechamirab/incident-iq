import { z } from 'zod';
import { ConfidenceScoreSchema } from '../../../../shared/schemas/common.schema.js';
import { AnalysisRunSummarySchema } from '../../../../shared/schemas/analysisRun.schema.js';
import { BiasTypeSchema, RiskLevelSchema } from '../../../../shared/schemas/bias.schema.js';
import { ActionCategorySchema, ActionPrioritySchema } from '../../../../shared/schemas/action.schema.js';
import { TimestampTypeSchema } from '../../../../shared/schemas/timeline.schema.js';

/**
 * The JSON shape the AI provider (mock or real) must return for one
 * incident-analysis pass. This intentionally differs from the persisted
 * `AnalysisRun`/`Hypothesis`/etc. domain schemas in `shared/schemas/` in
 * one important way: every system-managed field (`id`, `reviewStatus`,
 * a hypothesis's lifecycle `status`) is omitted here, because the AI must
 * never assign them -- ids are generated once the response is validated,
 * and a hypothesis's status always starts at `proposed` (never
 * `confirmed-by-human`, which only a human review action may set).
 *
 * Hypotheses instead carry a `tempId` (e.g. `"H1"`) the model invents so
 * that, within the same response, `recommendedActions` can forward-reference
 * a hypothesis before real ids exist. `mapAiResponseToAnalysisRun` resolves
 * these to generated ids after validation.
 */
export const AiTimelineEventSchema = z.object({
  timestamp: z.string(),
  title: z.string().min(1),
  description: z.string(),
  evidenceIds: z.array(z.string()),
  timestampType: TimestampTypeSchema,
  confidence: ConfidenceScoreSchema,
  isInferred: z.boolean(),
});

export const AiReasoningItemSchema = z.object({
  statement: z.string().min(1),
  explanation: z.string(),
  evidenceIds: z.array(z.string()),
  confidence: ConfidenceScoreSchema,
});

/** A fact must always cite at least one piece of evidence. */
export const AiFactSchema = AiReasoningItemSchema.extend({
  evidenceIds: z.array(z.string()).min(1, 'Every fact must cite at least one evidence id.'),
});

export const AiHypothesisSchema = z.object({
  tempId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  confidence: ConfidenceScoreSchema,
  confidenceReason: z.string().min(1),
  supportingEvidenceIds: z.array(z.string()),
  contradictingEvidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
  recommendedTest: z.string().min(1),
  expectedResult: z.string().min(1),
  /** The AI may only ever propose a hypothesis; see module doc above. */
  status: z.literal('proposed').optional(),
});

export const AiBiasFindingSchema = z.object({
  biasType: BiasTypeSchema,
  title: z.string().min(1),
  description: z.string(),
  detectedIn: z.string().min(1),
  evidenceIds: z.array(z.string()),
  riskLevel: RiskLevelSchema,
  mitigation: z.string(),
});

export const AiRecommendedActionSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  priority: ActionPrioritySchema,
  category: ActionCategorySchema,
  /** References hypotheses by their `tempId`, not a real id. */
  relatedHypothesisIds: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  expectedOutcome: z.string(),
  risk: z.string(),
});

export const AiAnalysisResponseSchema = z
  .object({
    summary: AnalysisRunSummarySchema,
    timeline: z.array(AiTimelineEventSchema),
    facts: z.array(AiFactSchema),
    assumptions: z.array(AiReasoningItemSchema),
    hypotheses: z.array(AiHypothesisSchema).min(3, 'At least three hypotheses are required.'),
    reasoningRisks: z.array(AiBiasFindingSchema),
    recommendedActions: z.array(AiRecommendedActionSchema),
    openQuestions: z.array(z.string()),
    unsupportedClaims: z.array(z.string()),
    uncertaintyStatement: z.string().min(1, 'An uncertainty statement is required.'),
  })
  .refine(
    (value) => {
      const tempIds = new Set(value.hypotheses.map((h) => h.tempId));
      return tempIds.size === value.hypotheses.length;
    },
    { message: 'Hypothesis tempIds must be unique.', path: ['hypotheses'] },
  );

export type AiAnalysisResponse = z.infer<typeof AiAnalysisResponseSchema>;
export type AiTimelineEvent = z.infer<typeof AiTimelineEventSchema>;
export type AiReasoningItem = z.infer<typeof AiReasoningItemSchema>;
export type AiFact = z.infer<typeof AiFactSchema>;
export type AiHypothesis = z.infer<typeof AiHypothesisSchema>;
export type AiBiasFinding = z.infer<typeof AiBiasFindingSchema>;
export type AiRecommendedAction = z.infer<typeof AiRecommendedActionSchema>;
