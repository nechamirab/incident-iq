import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common.schema.js';
import { EvidenceItemSchema } from './evidence.schema.js';
import { AnalysisRunSchema } from './analysisRun.schema.js';
import { SkepticReviewSchema } from './skepticReview.schema.js';
import { PostmortemSchema } from './postmortem.schema.js';

export const IncidentStatusSchema = z.enum([
  'draft',
  'analyzing',
  'under-investigation',
  'resolved',
  'archived',
]);

/**
 * Statuses a human may explicitly select (e.g. from the workspace's status
 * selector). Excludes `analyzing`, which is a transient, system-managed
 * state set automatically while an AI analysis run is in flight (see
 * `analysisService.analyzeIncident`) -- never a state a user chooses to
 * enter directly. Derived from {@link IncidentStatusSchema} via `.exclude`
 * so the two lists can never drift apart.
 */
export const UserSelectableIncidentStatusSchema = IncidentStatusSchema.exclude(['analyzing']);

export const IncidentSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Identifies which bundled synthetic dataset (if any) an incident belongs
 * to, so the Dashboard can offer them as one-click "load sample incident"
 * starting points. `custom` is used for every user-created incident.
 */
export const ScenarioTypeSchema = z.enum([
  'ecommerce-checkout',
  'course-registration-slowdown',
  'mobile-login-failure',
  'database-connection-leak',
  'payment-gateway-timeout',
  'async-queue-backlog',
  'custom',
]);

/**
 * The full incident aggregate: metadata plus its evidence, every analysis
 * run performed against it, every skeptic review of those runs, and its
 * postmortem (a single evolving document, unlike the append-only arrays
 * above -- see `PostmortemSchema`'s doc comment). This is intentionally
 * denormalized (nested, not referenced by id) since the mock persistence
 * layer stores and returns whole aggregates.
 */
export const IncidentSchema = z.object({
  id: IdSchema,
  title: z.string().min(1, 'title must not be empty'),
  description: z.string().min(1, 'description must not be empty'),
  scenarioType: ScenarioTypeSchema,
  status: IncidentStatusSchema,
  severity: IncidentSeveritySchema,
  affectedService: z.string().min(1, 'affectedService must not be empty'),
  startedAt: IsoDateTimeSchema.nullable(),
  detectedAt: IsoDateTimeSchema,
  resolvedAt: IsoDateTimeSchema.nullable(),
  /**
   * Free-form notes recorded when the incident was resolved. Preserved
   * across a reopen (moving back to `draft`/`under-investigation`) unless
   * a subsequent status update explicitly supplies a new value -- see
   * `incidentLifecycleService.updateIncidentStatus`.
   */
  resolutionNotes: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  evidence: z.array(EvidenceItemSchema),
  analysisRuns: z.array(AnalysisRunSchema),
  skepticReviews: z.array(SkepticReviewSchema),
  postmortem: PostmortemSchema.nullable(),
});

/**
 * Fields a caller supplies when creating an incident. Everything else
 * (`id`, `status`, `createdAt`/`updatedAt`, `evidence`, `analysisRuns`) is
 * assigned by the repository.
 */
export const CreateIncidentInputSchema = z.object({
  title: IncidentSchema.shape.title,
  description: IncidentSchema.shape.description,
  severity: IncidentSeveritySchema,
  affectedService: IncidentSchema.shape.affectedService,
  startedAt: IncidentSchema.shape.startedAt.optional(),
  detectedAt: IncidentSchema.shape.detectedAt,
  scenarioType: ScenarioTypeSchema.optional(),
});

/** Fields a caller may update after creation. */
export const UpdateIncidentInputSchema = CreateIncidentInputSchema.partial().extend({
  status: IncidentStatusSchema.optional(),
  resolvedAt: IncidentSchema.shape.resolvedAt.optional(),
  resolutionNotes: IncidentSchema.shape.resolutionNotes.optional(),
});
