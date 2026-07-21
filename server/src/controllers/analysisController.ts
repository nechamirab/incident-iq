import type { Request, RequestHandler, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import { analyzeIncident } from '../services/analysisService.js';

/**
 * `POST /api/incidents/:incidentId/analyze` -- runs one AI analysis pass
 * over an incident and returns the resulting analysis run.
 */
export function analyzeIncidentHandler(
  repository: IncidentRepository,
  provider: AIProvider,
): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId } = req.params as { incidentId: string };
    const run = await analyzeIncident(repository, provider, incidentId);
    const body: ApiResponse<AnalysisRun> = { success: true, data: run, error: null };
    res.status(201).json(body);
  };
}
