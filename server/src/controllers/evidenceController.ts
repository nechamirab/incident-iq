import type { Request, RequestHandler, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { EvidenceCreateRequest } from '../schemas/evidenceCreate.schema.js';
import { buildManualEvidenceItem } from '../services/evidenceService.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * `POST /api/incidents/:incidentId/evidence` -- adds a single, manually
 * entered evidence item to an existing incident, reusing the same
 * `IncidentRepository.addEvidence` persistence path the New Incident
 * form's bulk evidence extraction already uses.
 */
export function addEvidenceItem(repository: IncidentRepository): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId } = req.params as { incidentId: string };
    const request = req.body as EvidenceCreateRequest;

    const item = buildManualEvidenceItem(incidentId, request);
    const incident = await repository.addEvidence(incidentId, [item]);
    if (!incident) {
      throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
    }

    const body: ApiResponse<Incident> = { success: true, data: incident, error: null };
    res.status(201).json(body);
  };
}
