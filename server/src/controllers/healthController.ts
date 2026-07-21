import type { Request, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { HealthCheckResult } from '../../../shared/types/health.js';
import { config } from '../config/env.js';

/**
 * Reports basic backend liveness information, used by the frontend to
 * confirm connectivity during local development and demos.
 */
export function getHealth(_req: Request, res: Response): void {
  const result: HealthCheckResult = {
    status: 'ok',
    service: 'incident-iq-api',
    environment: config.nodeEnv,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  const body: ApiResponse<HealthCheckResult> = {
    success: true,
    data: result,
    error: null,
  };

  res.status(200).json(body);
}
