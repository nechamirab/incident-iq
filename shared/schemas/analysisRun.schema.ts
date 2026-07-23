import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common.schema.js';
import { BiasFindingSchema } from './bias.schema.js';
import { HypothesisSchema } from './hypothesis.schema.js';
import { ReasoningItemSchema } from './reasoning.schema.js';
import { RecommendedActionSchema } from './action.schema.js';
import { TimelineEventSchema } from './timeline.schema.js';

/** Which AI backend produced (or will produce) an analysis run. */
export const AiProviderNameSchema = z.enum(['mock', 'anthropic', 'openai']);

export const AnalysisRunStatusSchema = z.enum(['pending', 'completed', 'failed']);

/** High-level, evidence-grounded summary of the incident at analysis time. */
export const AnalysisRunSummarySchema = z.object({
  text: z.string().min(1, 'summary text must not be empty'),
  affectedComponents: z.array(z.string()),
  impact: z.string(),
});

/**
 * The full, validated result of one AI (or mock) analysis pass over an
 * incident's evidence. This is the persisted record the frontend renders
 * across the Overview, Timeline, Hypotheses, Reasoning Risks, Actions, and
 * AI Review sections of the incident workspace.
 */
export const AnalysisRunSchema = z.object({
  id: IdSchema,
  incidentId: IdSchema,
  /** The provider that actually produced this run -- `mock` even when standing in for a misconfigured `anthropic` setup as an explicit fallback. */
  provider: AiProviderNameSchema,
  model: z.string().min(1, 'model must not be empty'),
  promptVersion: z.string().min(1, 'promptVersion must not be empty'),
  createdAt: IsoDateTimeSchema,
  inputHash: z.string().min(1, 'inputHash must not be empty'),
  durationMs: z.number().nonnegative(),
  status: AnalysisRunStatusSchema,
  /**
   * What `AI_PROVIDER` was actually configured to when this run was
   * produced. Differs from `provider` only when `fallbackUsed` is `true`.
   * Optional so every pre-existing fixture/test literal stays valid; always
   * populated for a run produced through the real pipeline.
   */
  configuredProvider: AiProviderNameSchema.optional(),
  /** Whether `provider` differs from `configuredProvider` because `ALLOW_MOCK_FALLBACK` permitted substituting the mock provider. */
  fallbackUsed: z.boolean().optional(),
  /** Human-readable explanation of why fallback occurred; `null`/absent when `fallbackUsed` is not `true`. */
  fallbackReason: z.string().nullable().optional(),
  /** A safe, provider-issued request id (e.g. from OpenAI's `x-request-id` header), when the provider exposes one -- never an auth header or other secret. `null`/absent when not available (e.g. mock, or a provider that doesn't track one). */
  providerRequestId: z.string().nullable().optional(),
  /**
   * Whether a targeted completion-repair pass was attempted after the
   * initial response validated successfully but a quality gate found it
   * incomplete (e.g. no reasoning risks, no recommended actions). `false`/
   * absent when the first response already passed the quality gate.
   */
  completionRepairAttempted: z.boolean().optional(),
  /**
   * Which sections the completion-repair pass actually improved (e.g.
   * `["reasoningRisks", "recommendedActions"]`) -- empty when no repair was
   * attempted, or when a repair was attempted but did not produce grounded
   * content for any deficient section (the original result is kept either
   * way; see `qualityWarnings`).
   */
  completionRepairedSections: z.array(z.string()).optional(),
  /**
   * Non-blocking completeness/quality observations from the
   * provider-independent quality gate (e.g. "no reasoning risks were
   * identified despite N evidence items") -- distinct from
   * `validationWarnings`, which covers schema/evidence-integrity issues.
   * A quality warning never means the run is invalid; some incidents
   * genuinely have no contradicting evidence or no detectable bias.
   */
  qualityWarnings: z.array(z.string()).optional(),
  summary: AnalysisRunSummarySchema,
  timeline: z.array(TimelineEventSchema),
  facts: z.array(ReasoningItemSchema),
  assumptions: z.array(ReasoningItemSchema),
  hypotheses: z.array(HypothesisSchema),
  reasoningRisks: z.array(BiasFindingSchema),
  recommendedActions: z.array(RecommendedActionSchema),
  openQuestions: z.array(z.string()),
  unsupportedClaims: z.array(z.string()),
  uncertaintyStatement: z.string(),
  validationWarnings: z.array(z.string()),
  rawResponse: z.unknown(),
});
