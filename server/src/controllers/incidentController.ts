import type { Request, RequestHandler, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { Incident } from '../../../shared/types/incident.js';
import { SAMPLE_INCIDENT_IDS } from '../data/incidents/index.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { IncidentIntakeRequest } from '../schemas/incidentIntake.schema.js';
import { ApiError } from '../utils/ApiError.js';
import { createIncidentWithEvidence } from '../services/incidentService.js';

/** `GET /api/incidents` -- lists every incident (seeded samples + created). */
export function listIncidents(repository: IncidentRepository): RequestHandler {
  return async (_req: Request, res: Response): Promise<void> => {
    const incidents = await repository.findAll();
    const body: ApiResponse<Incident[]> = { success: true, data: incidents, error: null };
    res.status(200).json(body);
  };
}

/**
 * `GET /api/incidents/samples` -- lists only the bundled preset sample
 * incidents (by their fixed seed ids), never a user-created incident. Must
 * be registered before `GET /:incidentId` so "samples" isn't swallowed by
 * that param route.
 */
export function listSampleIncidents(repository: IncidentRepository): RequestHandler {
  return async (_req: Request, res: Response): Promise<void> => {
    const found = await Promise.all(SAMPLE_INCIDENT_IDS.map((id) => repository.findById(id)));
    const incidents = found.filter((incident): incident is Incident => incident !== null);
    const body: ApiResponse<Incident[]> = { success: true, data: incidents, error: null };
    res.status(200).json(body);
  };
}

/** `GET /api/incidents/:incidentId` -- fetches a single incident. */
export function getIncidentById(repository: IncidentRepository): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId } = req.params as { incidentId: string };
    const incident = await repository.findById(incidentId);
    if (!incident) {
      throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
    }

    const body: ApiResponse<Incident> = { success: true, data: incident, error: null };
    res.status(200).json(body);
  };
}

/**
 * `POST /api/incidents` -- creates an incident from the New Incident form,
 * extracting evidence from both its text fields and any uploaded files.
 */
export function createIncident(repository: IncidentRepository): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const intake = req.body as IncidentIntakeRequest;
    const uploadedFiles = (req.files as Express.Multer.File[] | undefined) ?? [];
    const files = uploadedFiles.map((file) => ({
      originalName: file.originalname,
      buffer: file.buffer,
    }));

    const incident = await createIncidentWithEvidence(repository, intake, files);
    const body: ApiResponse<Incident> = { success: true, data: incident, error: null };
    res.status(201).json(body);
  };
}
