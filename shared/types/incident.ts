import type { z } from 'zod';
import type {
  CreateIncidentInputSchema,
  IncidentSchema,
  IncidentSeveritySchema,
  IncidentStatusSchema,
  ScenarioTypeSchema,
  UpdateIncidentInputSchema,
  UserSelectableIncidentStatusSchema,
} from '../schemas/incident.schema.js';

export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;
export type UserSelectableIncidentStatus = z.infer<typeof UserSelectableIncidentStatusSchema>;
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;
export type ScenarioType = z.infer<typeof ScenarioTypeSchema>;
export type Incident = z.infer<typeof IncidentSchema>;
export type CreateIncidentInput = z.infer<typeof CreateIncidentInputSchema>;
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentInputSchema>;
