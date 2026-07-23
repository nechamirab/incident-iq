import type { Request, RequestHandler, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { HypothesisStatusUpdateRequest } from '../schemas/hypothesisStatusUpdate.schema.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * `PATCH /api/incidents/:incidentId/hypotheses/:hypothesisId/status` -- the
 * one and only human-in-the-loop path that can transition a hypothesis's
 * status, including to `confirmed-by-human`. The AI providers never call
 * this; it exists solely for an explicit user action (see
 * `HypothesisStatusUpdateRequestSchema` for the `confirmed: true`
 * safeguard required specifically for that status value, validated by
 * `validateBody` before this handler ever runs).
 */
export function updateHypothesisStatusHandler(repository: IncidentRepository): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId, hypothesisId } = req.params as { incidentId: string; hypothesisId: string };
    const { status, humanReviewNote } = req.body as HypothesisStatusUpdateRequest;

    const incident = await repository.updateHypothesisStatus(
      incidentId,
      hypothesisId,
      status,
      humanReviewNote ?? null,
    );
    if (!incident) {
      throw new ApiError(
        404,
        'HYPOTHESIS_NOT_FOUND',
        `No hypothesis with id "${hypothesisId}" was found on incident "${incidentId}".`,
      );
    }

    const body: ApiResponse<Incident> = { success: true, data: incident, error: null };
    res.status(200).json(body);
  };
}
