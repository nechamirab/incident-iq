import type { Request, RequestHandler, Response } from 'express';
import type { ApiResponse } from '../../../shared/types/apiResponse.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { StatementReviewRequest } from '../schemas/statementReview.schema.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * `PATCH /api/incidents/:incidentId/statements/:statementId/review` -- lets
 * a human reviewer mark a fact or assumption as supported, partially
 * supported, unsupported, or rejected.
 */
export function reviewStatement(repository: IncidentRepository): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { incidentId, statementId } = req.params as { incidentId: string; statementId: string };
    const { reviewStatus } = req.body as StatementReviewRequest;

    const incident = await repository.updateStatementReviewStatus(incidentId, statementId, reviewStatus);
    if (!incident) {
      throw new ApiError(
        404,
        'STATEMENT_NOT_FOUND',
        `No fact or assumption with id "${statementId}" was found on incident "${incidentId}".`,
      );
    }

    const body: ApiResponse<Incident> = { success: true, data: incident, error: null };
    res.status(200).json(body);
  };
}
