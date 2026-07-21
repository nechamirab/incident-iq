import type { Incident } from '../../../shared/types/incident.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { UploadedFileInput } from '../parsers/index.js';
import type { IncidentIntakeRequest } from '../schemas/incidentIntake.schema.js';
import { ApiError } from '../utils/ApiError.js';
import { buildEvidenceFromIntake } from './evidenceService.js';

/**
 * Creates a new incident and extracts evidence from both its free-form
 * text fields and any uploaded files, persisting both in one operation.
 *
 * @param repository The incident repository to persist through.
 * @param intake The validated incident intake request body.
 * @param files Uploaded files, already validated for type/size by Multer.
 * @returns The newly created incident, including its extracted evidence.
 */
export async function createIncidentWithEvidence(
  repository: IncidentRepository,
  intake: IncidentIntakeRequest,
  files: UploadedFileInput[],
): Promise<Incident> {
  const incident = await repository.create(intake);
  const evidence = buildEvidenceFromIntake(incident.id, intake, files);

  if (evidence.length === 0) {
    return incident;
  }

  const updated = await repository.addEvidence(incident.id, evidence);
  if (!updated) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Incident was created but evidence could not be attached.');
  }

  return updated;
}
