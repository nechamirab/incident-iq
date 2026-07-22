import type { Request, RequestHandler, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { PostmortemEditRequest } from '../schemas/postmortemEdit.schema.js';
import { editPostmortem, generatePostmortem } from '../services/postmortemService.js';

/**
 * `POST /api/incidents/:incidentId/postmortem` -- generates (or
 * regenerates, discarding any prior draft/edits) an AI postmortem draft
 * from the incident's most recent analysis run.
 */
export function generatePostmortemHandler(
  repository: IncidentRepository,
  provider: AIProvider,
): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId } = req.params as { incidentId: string };
    const incident = await generatePostmortem(repository, provider, incidentId);
    const body: ApiResponse<Incident> = { success: true, data: incident, error: null };
    res.status(201).json(body);
  };
}

/**
 * `PATCH /api/incidents/:incidentId/postmortem` -- lets a human reviewer
 * edit any subset of an existing postmortem draft's content fields.
 */
export function editPostmortemHandler(repository: IncidentRepository): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId } = req.params as { incidentId: string };
    const patch = req.body as PostmortemEditRequest;
    const incident = await editPostmortem(repository, incidentId, patch);
    const body: ApiResponse<Incident> = { success: true, data: incident, error: null };
    res.status(200).json(body);
  };
}
