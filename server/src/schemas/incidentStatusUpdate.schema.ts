import { z } from 'zod';
import { IsoDateTimeSchema } from '../../../shared/schemas/common.schema.js';
import { UserSelectableIncidentStatusSchema } from '../../../shared/schemas/incident.schema.js';

/**
 * Request body for `PATCH /api/incidents/:incidentId/status`. `resolvedAt`
 * is required when `status` is `"resolved"` (the resolution dialog always
 * supplies one) and ignored for every other status -- the server computes
 * the persisted `resolvedAt` itself from the transition rules in
 * `incidentLifecycleService.computeResolvedAt`, rather than trusting a
 * client-supplied value for non-resolution transitions.
 */
export const IncidentStatusUpdateRequestSchema = z
  .object({
    status: UserSelectableIncidentStatusSchema,
    resolvedAt: IsoDateTimeSchema.optional(),
    resolutionNotes: z.string().optional(),
  })
  .refine((value) => value.status !== 'resolved' || Boolean(value.resolvedAt), {
    message: 'resolvedAt is required when status is "resolved".',
    path: ['resolvedAt'],
  });

export type IncidentStatusUpdateRequest = z.infer<typeof IncidentStatusUpdateRequestSchema>;
