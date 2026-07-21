import express, { type Express } from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Builds and configures the Express application (without starting a
 * listener), so it can be reused by both the runtime entry point and
 * future integration tests.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
