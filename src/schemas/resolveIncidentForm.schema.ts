import { z } from 'zod';

/**
 * Validation schema for the "Confirm Resolution" dialog. `resolvedAt`
 * comes from a native `datetime-local` input (`YYYY-MM-DDTHH:mm`, no
 * timezone), validated the same way the New Incident form's date/time
 * fields are (see `newIncidentForm.schema.ts`) and converted to a full
 * ISO-8601 string at submission time.
 */
export const ResolveIncidentFormSchema = z.object({
  resolvedAt: z
    .string()
    .min(1, 'Resolved date and time is required.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time.'),
  resolutionNotes: z.string(),
});

export type ResolveIncidentFormValues = z.infer<typeof ResolveIncidentFormSchema>;
