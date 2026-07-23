import type { Request, RequestHandler, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { HealthCheckResult } from '../../../shared/types/health.js';
import { getAiProviderDiagnostics } from '../ai/providers/createAIProvider.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import { config } from '../config/env.js';

/**
 * Reports basic backend liveness information plus safe AI provider
 * diagnostics, used by the frontend to confirm connectivity during local
 * development and demos and by operators to confirm the AI provider is
 * configured as expected -- never makes a provider request, and never
 * returns the API key or any part of it.
 */
export function getHealth(aiProvider: AIProvider): RequestHandler {
  return (_req: Request, res: Response): void => {
    const result: HealthCheckResult = {
      status: 'ok',
      service: 'incident-iq-api',
      environment: config.nodeEnv,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
      ai: getAiProviderDiagnostics(config, aiProvider),
    };

    const body: ApiResponse<HealthCheckResult> = {
      success: true,
      data: result,
      error: null,
    };

    res.status(200).json(body);
  };
}
