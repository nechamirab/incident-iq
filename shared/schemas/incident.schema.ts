import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common.schema.js';
import { EvidenceItemSchema } from './evidence.schema.js';
import { AnalysisRunSchema } from './analysisRun.schema.js';

export const IncidentStatusSchema = z.enum([
  'draft',
  'analyzing',
  'under-investigation',
  'resolved',
  'archived',
]);

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
  'custom',
]);

/**
 * The full incident aggregate: metadata plus its evidence and every
 * analysis run performed against it. This is intentionally denormalized
 * (evidence and analysis runs are nested, not referenced by id) since the
 * mock persistence layer stores and returns whole aggregates.
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
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  evidence: z.array(EvidenceItemSchema),
  analysisRuns: z.array(AnalysisRunSchema),
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
});
