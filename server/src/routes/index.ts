import { Router } from 'express';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import { healthRouter } from './healthRoutes.js';
import { createIncidentRouter } from './incidentRoutes.js';

/**
 * Builds the top-level `/api` router. Takes the incident repository as a
 * parameter (rather than importing the process-wide singleton directly)
 * so the app factory can inject an isolated repository in tests.
 */
export function createApiRouter(incidentRepository: IncidentRepository): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/incidents', createIncidentRouter(incidentRepository));

  return router;
}
