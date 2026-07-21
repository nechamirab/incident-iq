import { z } from 'zod';
import { CreateIncidentInputSchema } from '../../../shared/schemas/incident.schema.js';

/**
 * Request body for `POST /api/incidents`. Extends the base incident
 * creation contract with the free-form evidence fields collected by the
 * New Incident form. Every field arrives as a string because it is
 * submitted via `multipart/form-data` (required for the accompanying file
 * uploads); empty/omitted textareas are treated as "no evidence supplied"
 * rather than an error.
 */
export const IncidentIntakeRequestSchema = CreateIncidentInputSchema.extend({
  applicationLogs: z.string().optional(),
  errorTraces: z.string().optional(),
  monitoringAlerts: z.string().optional(),
  deploymentNotes: z.string().optional(),
  userComplaints: z.string().optional(),
  apiErrors: z.string().optional(),
  databaseErrors: z.string().optional(),
});

export type IncidentIntakeRequest = z.infer<typeof IncidentIntakeRequestSchema>;
