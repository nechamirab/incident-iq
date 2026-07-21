import { Router } from 'express';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import { healthRouter } from './healthRoutes.js';
import { createIncidentRouter } from './incidentRoutes.js';

/**
 * Builds the top-level `/api` router. Takes the incident repository and AI
 * provider as parameters (rather than importing process-wide singletons
 * directly) so the app factory can inject isolated/fake instances in tests.
 */
export function createApiRouter(incidentRepository: IncidentRepository, aiProvider: AIProvider): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/incidents', createIncidentRouter(incidentRepository, aiProvider));

  return router;
}
