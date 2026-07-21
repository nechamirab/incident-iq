import { Router } from 'express';
import { MAX_FILES_PER_INCIDENT } from '../../../shared/constants/fileUpload.js';
import { createIncident, getIncidentById, listIncidents } from '../controllers/incidentController.js';
import { incidentEvidenceUpload } from '../middleware/upload.js';
import { validateBody } from '../middleware/validateRequest.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import { IncidentIntakeRequestSchema } from '../schemas/incidentIntake.schema.js';

/**
 * Builds the `/api/incidents` router against a specific repository
 * instance, so tests can inject an isolated, freshly-seeded repository
 * instead of sharing the process-wide singleton.
 */
export function createIncidentRouter(repository: IncidentRepository): Router {
  const router = Router();

  router.get('/', listIncidents(repository));
  router.get('/:incidentId', getIncidentById(repository));
  router.post(
    '/',
    incidentEvidenceUpload.array('files', MAX_FILES_PER_INCIDENT),
    validateBody(IncidentIntakeRequestSchema),
    createIncident(repository),
  );

  return router;
}
