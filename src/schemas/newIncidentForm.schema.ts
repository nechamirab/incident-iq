import { z } from 'zod';
import { IncidentSeveritySchema, ScenarioTypeSchema } from '../../shared/schemas/incident.schema.js';

/**
 * Validation schema for the New Incident form. Date/time fields come from
 * native `datetime-local` inputs (`YYYY-MM-DDTHH:mm`, no timezone), so they
 * are validated as "parseable by the browser's Date constructor" here and
 * converted to full ISO-8601 strings at submission time, rather than
 * validated against the stricter ISO format the backend expects.
 *
 * Every field is a required (non-optional) string -- React Hook Form's
 * `defaultValues` always supplies `''` for unset text fields, so there is
 * never a meaningful "absent" state to model separately from "empty".
 */
export const NewIncidentFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.'),
    description: z.string().trim().min(1, 'Description is required.'),
    severity: IncidentSeveritySchema,
    affectedService: z.string().trim().min(1, 'Affected service is required.'),
    startedAt: z.string(),
    detectedAt: z
      .string()
      .min(1, 'Detection time is required.')
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time.'),
    applicationLogs: z.string(),
    errorTraces: z.string(),
    monitoringAlerts: z.string(),
    deploymentNotes: z.string(),
    userComplaints: z.string(),
    apiErrors: z.string(),
    databaseErrors: z.string(),
    scenarioType: ScenarioTypeSchema,
  })
  .refine((value) => value.startedAt === '' || !Number.isNaN(Date.parse(value.startedAt)), {
    message: 'Enter a valid date and time.',
    path: ['startedAt'],
  });

export type NewIncidentFormValues = z.infer<typeof NewIncidentFormSchema>;
