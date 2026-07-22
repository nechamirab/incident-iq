import type { Request, RequestHandler, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { SkepticReview } from '../../../shared/types/skepticReview.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { SkepticReviewNotesRequest } from '../schemas/skepticReviewNotes.schema.js';
import { runSkepticReview } from '../services/skepticReviewService.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * `POST /api/incidents/:incidentId/skeptic-review` -- runs one skeptic
 * review of an incident's most recent analysis run and returns it.
 */
export function triggerSkepticReview(
  repository: IncidentRepository,
  provider: AIProvider,
): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId } = req.params as { incidentId: string };
    const review = await runSkepticReview(repository, provider, incidentId);
    const body: ApiResponse<SkepticReview> = { success: true, data: review, error: null };
    res.status(201).json(body);
  };
}

/**
 * `PATCH /api/incidents/:incidentId/skeptic-reviews/:reviewId/notes` -- lets
 * a human reviewer record their own notes on a skeptic review.
 */
export function updateSkepticReviewNotes(repository: IncidentRepository): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId, reviewId } = req.params as { incidentId: string; reviewId: string };
    const { humanNotes } = req.body as SkepticReviewNotesRequest;

    const incident = await repository.updateSkepticReviewNotes(incidentId, reviewId, humanNotes);
    if (!incident) {
      throw new ApiError(
        404,
        'SKEPTIC_REVIEW_NOT_FOUND',
        `No skeptic review with id "${reviewId}" was found on incident "${incidentId}".`,
      );
    }

    const body: ApiResponse<Incident> = { success: true, data: incident, error: null };
    res.status(200).json(body);
  };
}
