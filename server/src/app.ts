import express, { type Express } from 'express';
import cors from 'cors';
import type { AIProvider } from './ai/providers/AIProvider.js';
import { createAIProvider } from './ai/providers/createAIProvider.js';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { incidentRepository as defaultIncidentRepository } from './repositories/index.js';
import type { IncidentRepository } from './repositories/IncidentRepository.js';
import { createApiRouter } from './routes/index.js';

export interface AppDependencies {
  incidentRepository: IncidentRepository;
  aiProvider: AIProvider;
}

/**
 * Builds and configures the Express application (without starting a
 * listener), so it can be reused by both the runtime entry point and
 * tests. Defaults to the process-wide singleton repository and the
 * environment-selected AI provider; tests can inject an isolated
 * repository and/or a fake provider instead.
 */
export function createApp(deps: Partial<AppDependencies> = {}): Express {
  const incidentRepository = deps.incidentRepository ?? defaultIncidentRepository;
  const aiProvider = deps.aiProvider ?? createAIProvider();

  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', createApiRouter(incidentRepository, aiProvider));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
