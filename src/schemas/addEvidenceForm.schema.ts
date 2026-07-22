import { z } from 'zod';
import type { EvidenceSourceType } from '../../shared/types/evidence';

/**
 * Source types offered by the "Add Evidence Item" dialog -- a deliberately
 * curated subset of the full {@link EvidenceSourceType} enum (mirroring how
 * `EVIDENCE_TEXT_FIELDS` curates a subset for the New Incident form), not a
 * duplicate or re-declaration of it: every value here is one of the real
 * enum's literals, checked by `satisfies`.
 */
export const ADD_EVIDENCE_SOURCE_TYPES = [
  'application-log',
  'monitoring-alert',
  'support-message',
] as const satisfies readonly EvidenceSourceType[];

/**
 * Validation schema for the "Add Evidence Item" dialog. `timestamp` comes
 * from an optional native `datetime-local` input, validated the same way
 * as elsewhere in the app and converted to a full ISO-8601 string at
 * submission time.
 */
export const AddEvidenceFormSchema = z.object({
  sourceType: z.enum(ADD_EVIDENCE_SOURCE_TYPES),
  sourceName: z.string().trim().min(1, 'Source name is required.'),
  content: z
    .string()
    .min(1, 'Content is required.')
    .refine((value) => value.trim().length > 0, 'Content must not be blank.'),
  timestamp: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), 'Enter a valid date and time.'),
});

export type AddEvidenceFormValues = z.infer<typeof AddEvidenceFormSchema>;
