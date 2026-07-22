import { EVIDENCE_TEXT_FIELDS } from '../../../shared/constants/evidenceFields.js';
import type { EvidenceItem } from '../../../shared/types/evidence.js';
import {
  parseSingleBlock,
  parseTextContent,
  parseUploadedFile,
  type UploadedFileInput,
} from '../parsers/index.js';
import type { EvidenceCreateRequest } from '../schemas/evidenceCreate.schema.js';
import type { IncidentIntakeRequest } from '../schemas/incidentIntake.schema.js';
import { createId } from '../utils/id.js';
import { normalizeLineEndings } from '../utils/normalizeText.js';

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

/**
 * Builds a single evidence item manually added to an already-existing
 * incident (as opposed to the bulk extraction {@link buildEvidenceFromIntake}
 * performs at creation time). `originalContent` preserves the submitted
 * text verbatim (trimmed); `normalizedContent` is derived from it the same
 * way every other evidence item's is. The id is generated here via the
 * project's single id-generation mechanism -- never by the caller.
 *
 * @param incidentId The incident this evidence belongs to.
 * @param request The validated evidence-creation request body.
 * @returns The new evidence item, ready to persist via `IncidentRepository.addEvidence`.
 */
export function buildManualEvidenceItem(
  incidentId: string,
  request: EvidenceCreateRequest,
): EvidenceItem {
  return {
    id: createId('evidence'),
    incidentId,
    sourceType: request.sourceType,
    sourceName: request.sourceName,
    originalContent: request.content.trim(),
    normalizedContent: normalizeLineEndings(request.content),
    timestamp: request.timestamp ?? null,
    lineNumber: null,
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}
