import { Router } from 'express';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { getHealth } from '../controllers/healthController.js';

/** Builds the `/api/health` router against a specific AI provider, matching every other route factory's DI pattern. */
export function createHealthRouter(aiProvider: AIProvider): Router {
  const router = Router();
  router.get('/', getHealth(aiProvider));
  return router;
}
