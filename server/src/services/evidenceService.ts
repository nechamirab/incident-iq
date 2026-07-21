import { EVIDENCE_TEXT_FIELDS } from '../../../shared/constants/evidenceFields.js';
import type { EvidenceItem } from '../../../shared/types/evidence.js';
import {
  parseSingleBlock,
  parseTextContent,
  parseUploadedFile,
  type UploadedFileInput,
} from '../parsers/index.js';
import type { IncidentIntakeRequest } from '../schemas/incidentIntake.schema.js';

/**
 * Builds the full evidence list for a new incident: one evidence item for
 * the incident description, one per non-empty line of every free-form
 * evidence field (see {@link EVIDENCE_TEXT_FIELDS}), and one or more per
 * uploaded file (depending on its format). Every item is stamped with a
 * unique id and the same ingestion timestamp.
 *
 * @param incidentId The incident this evidence belongs to.
 * @param intake The validated incident intake request body.
 * @param files Uploaded files (already validated for type/size by Multer).
 * @returns The complete evidence list, in a stable, predictable order.
 */
export function buildEvidenceFromIntake(
  incidentId: string,
  intake: IncidentIntakeRequest,
  files: UploadedFileInput[],
): EvidenceItem[] {
  const createdAt = new Date().toISOString();
  const evidence: EvidenceItem[] = [];

  evidence.push(
    ...parseSingleBlock(
      intake.description,
      incidentId,
      'incident-description',
      'Incident description',
      createdAt,
    ),
  );

  for (const { field, sourceType, label } of EVIDENCE_TEXT_FIELDS) {
    const value = intake[field];
    if (!value) {
      continue;
    }
    evidence.push(...parseTextContent(value, incidentId, sourceType, label, createdAt));
  }

  for (const file of files) {
    evidence.push(...parseUploadedFile(file, incidentId, createdAt));
  }

  return evidence;
}
