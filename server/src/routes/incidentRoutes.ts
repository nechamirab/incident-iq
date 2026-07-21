import { Router } from 'express';
import { MAX_FILES_PER_INCIDENT } from '../../../shared/constants/fileUpload.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { analyzeIncidentHandler } from '../controllers/analysisController.js';
import { createIncident, getIncidentById, listIncidents } from '../controllers/incidentController.js';
import { reviewStatement } from '../controllers/statementController.js';
import { incidentEvidenceUpload } from '../middleware/upload.js';
import { validateBody } from '../middleware/validateRequest.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import { IncidentIntakeRequestSchema } from '../schemas/incidentIntake.schema.js';
import { StatementReviewRequestSchema } from '../schemas/statementReview.schema.js';

/**
 * Builds the `/api/incidents` router against a specific repository and AI
 * provider, so tests can inject isolated/fake instances instead of sharing
 * the process-wide singletons.
 */
export function createIncidentRouter(repository: IncidentRepository, aiProvider: AIProvider): Router {
  const router = Router();

  router.get('/', listIncidents(repository));
  router.get('/:incidentId', getIncidentById(repository));
  router.post(
    '/',
    incidentEvidenceUpload.array('files', MAX_FILES_PER_INCIDENT),
    validateBody(IncidentIntakeRequestSchema),
    createIncident(repository),
  );
  router.post('/:incidentId/analyze', analyzeIncidentHandler(repository, aiProvider));
  router.patch(
    '/:incidentId/statements/:statementId/review',
    validateBody(StatementReviewRequestSchema),
    reviewStatement(repository),
  );

  return router;
}
