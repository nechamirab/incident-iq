import type { Request, RequestHandler, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { IncidentStatusUpdateRequest } from '../schemas/incidentStatusUpdate.schema.js';
import { updateIncidentStatus } from '../services/incidentLifecycleService.js';

/**
 * `PATCH /api/incidents/:incidentId/status` -- updates an incident's
 * lifecycle status (and, for a resolution, its `resolvedAt`/
 * `resolutionNotes`), applying the resolution lifecycle rules in
 * `incidentLifecycleService`.
 */
export function updateIncidentStatusHandler(repository: IncidentRepository): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId } = req.params as { incidentId: string };
    const request = req.body as IncidentStatusUpdateRequest;

    const incident = await updateIncidentStatus(repository, incidentId, request);
    const body: ApiResponse<Incident> = { success: true, data: incident, error: null };
    res.status(200).json(body);
  };
}
