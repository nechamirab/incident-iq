import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, MetadataSchema } from './common.schema.js';

/** Where a piece of evidence originated from. */
export const EvidenceSourceTypeSchema = z.enum([
  'incident-description',
  'application-log',
  'error-trace',
  'monitoring-alert',
  'deployment-note',
  'user-report',
  'support-message',
  'api-error',
  'database-error',
  'uploaded-file',
  'other',
]);

/**
 * A single, individually-referenceable piece of evidence attached to an
 * incident. `originalContent` is preserved verbatim (as supplied or
 * uploaded); `normalizedContent` is the cleaned-up version used for display
 * and analysis (trimmed, line-ending-normalized, optionally redacted).
 */
export const EvidenceItemSchema = z.object({
  id: IdSchema,
  incidentId: IdSchema,
  sourceType: EvidenceSourceTypeSchema,
  sourceName: z.string().min(1, 'sourceName must not be empty'),
  originalContent: z.string(),
  normalizedContent: z.string(),
  timestamp: IsoDateTimeSchema.nullable(),
  lineNumber: z.number().int().positive().nullable(),
  metadata: MetadataSchema,
  createdAt: IsoDateTimeSchema,
});
