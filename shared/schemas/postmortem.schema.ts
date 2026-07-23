import { z } from 'zod';
import { IsoDateTimeSchema } from './common.schema.js';
import { AiProviderNameSchema } from './analysisRun.schema.js';

/**
 * A human-reviewed postmortem draft. Deliberately uses "likely explanation"
 * rather than "confirmed root cause" language unless a human has explicitly
 * confirmed a hypothesis (see {@link HypothesisStatusSchema}'s
 * `confirmed-by-human` state).
 *
 * Unlike `AnalysisRun`/`SkepticReview` (append-only audit trails), a
 * postmortem is a single, evolving document per incident: every content
 * field below stays human-editable in place after the AI drafts it, rather
 * than being paired with a separate "human notes" field. `provider`/
 * `model`/`promptVersion`/`generatedAt` are null until a draft has been
 * generated at least once; `lastEditedAt` is null until a human has saved
 * an edit, and is bumped on every edit thereafter (independent of
 * `generatedAt`, which only changes when the draft is regenerated).
 */
export const PostmortemSchema = z.object({
  incidentSummary: z.string().min(1, 'incidentSummary must not be empty'),
  impact: z.string(),
  detection: z.string(),
  timeline: z.string(),
  contributingFactors: z.array(z.string()),
  hypothesesInvestigated: z.array(z.string()),
  likelyCause: z.string(),
  uncertaintyStatement: z.string(),
  resolution: z.string(),
  correctiveActions: z.array(z.string()),
  lessonsLearned: z.array(z.string()),
  followUpItems: z.array(z.string()),
  provider: AiProviderNameSchema.nullable(),
  model: z.string().nullable(),
  promptVersion: z.string().nullable(),
  generatedAt: IsoDateTimeSchema.nullable(),
  lastEditedAt: IsoDateTimeSchema.nullable(),
  /** What `AI_PROVIDER` was actually configured to when this draft was generated; see `AnalysisRunSchema`'s matching field. */
  configuredProvider: AiProviderNameSchema.nullable().optional(),
  fallbackUsed: z.boolean().optional(),
  fallbackReason: z.string().nullable().optional(),
  /** A safe, provider-issued request id, when the provider exposes one; see `AnalysisRunSchema`'s matching field. */
  providerRequestId: z.string().nullable().optional(),
});
