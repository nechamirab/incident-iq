import { z } from 'zod';
import { IsoDateTimeSchema } from '../../../shared/schemas/common.schema.js';
import { EvidenceSourceTypeSchema } from '../../../shared/schemas/evidence.schema.js';

/**
 * Request body for `POST /api/incidents/:incidentId/evidence` -- adding a
 * single evidence item to an incident that already exists (as opposed to
 * the bulk evidence extracted from the New Incident form's free-text
 * fields/uploads at creation time). `content` rejects whitespace-only
 * input; the existing global `express.json({ limit: '1mb' })` body-size
 * limit (see `app.ts`) is the content-size limit applied here, matching
 * every other JSON-body endpoint rather than introducing a new one.
 */
export const EvidenceCreateRequestSchema = z.object({
  sourceType: EvidenceSourceTypeSchema,
  sourceName: z.string().trim().min(1, 'sourceName must not be empty'),
  content: z
    .string()
    .min(1, 'content must not be empty')
    .refine((value) => value.trim().length > 0, 'content must not be blank'),
  timestamp: IsoDateTimeSchema.optional(),
});

export type EvidenceCreateRequest = z.infer<typeof EvidenceCreateRequestSchema>;
