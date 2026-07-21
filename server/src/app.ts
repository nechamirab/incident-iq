import express, { type Express } from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { incidentRepository as defaultIncidentRepository } from './repositories/index.js';
import type { IncidentRepository } from './repositories/IncidentRepository.js';
import { createApiRouter } from './routes/index.js';

export interface AppDependencies {
  incidentRepository: IncidentRepository;
}

/**
 * Builds and configures the Express application (without starting a
 * listener), so it can be reused by both the runtime entry point and
 * tests. Defaults to the process-wide singleton repository; tests can
 * inject an isolated, freshly-seeded one instead.
 */
export function createApp(deps: Partial<AppDependencies> = {}): Express {
  const incidentRepository = deps.incidentRepository ?? defaultIncidentRepository;

  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', createApiRouter(incidentRepository));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
