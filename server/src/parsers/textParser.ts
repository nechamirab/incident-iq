import type { EvidenceItem, EvidenceSourceType } from '../../../shared/types/evidence.js';
import { createId } from '../utils/id.js';
import { normalizeLineEndings } from '../utils/normalizeText.js';
import { splitNonEmptyLines } from '../utils/splitLines.js';

/**
 * Parses free-form, line-oriented text (a pasted textarea value, or the
 * contents of an uploaded `.txt`/`.log` file) into one evidence item per
 * non-empty line. Shared by both input paths because the correct handling
 * is identical: log-like text is only meaningful line by line, and giving
 * each line its own evidence id lets later analysis stages cite it
 * precisely.
 *
 * Content is only ever read as plain text -- never evaluated or executed.
 *
 * @param content Raw, untrusted text.
 * @param incidentId The incident this evidence belongs to.
 * @param sourceType The evidence category to tag every produced item with.
 * @param sourceName Human-readable origin (a field label or a file name).
 * @param createdAt ISO timestamp recorded as when this evidence was ingested.
 * @returns One evidence item per non-empty line, in source order.
 */
export function parseTextContent(
  content: string,
  incidentId: string,
  sourceType: EvidenceSourceType,
  sourceName: string,
  createdAt: string,
): EvidenceItem[] {
  return splitNonEmptyLines(content).map((line) => ({
    id: createId('evidence'),
    incidentId,
    sourceType,
    sourceName,
    originalContent: line.content,
    normalizedContent: normalizeLineEndings(line.content),
    timestamp: null,
    lineNumber: line.lineNumber,
    metadata: {},
    createdAt,
  }));
}

/**
 * Parses free-form prose (the incident description) as a single evidence
 * item, unlike {@link parseTextContent} which treats its input as
 * line-oriented log data. Returns an empty array for blank input.
 *
 * @param content Raw, untrusted text.
 * @param incidentId The incident this evidence belongs to.
 * @param sourceType The evidence category to tag the produced item with.
 * @param sourceName Human-readable origin (a field label or a file name).
 * @param createdAt ISO timestamp recorded as when this evidence was ingested.
 * @returns A single-item array, or an empty array if `content` is blank.
 */
export function parseSingleBlock(
  content: string,
  incidentId: string,
  sourceType: EvidenceSourceType,
  sourceName: string,
  createdAt: string,
): EvidenceItem[] {
  const normalized = normalizeLineEndings(content);
  if (normalized.length === 0) {
    return [];
  }

  return [
    {
      id: createId('evidence'),
      incidentId,
      sourceType,
      sourceName,
      originalContent: content.trim(),
      normalizedContent: normalized,
      timestamp: null,
      lineNumber: null,
      metadata: {},
      createdAt,
    },
  ];
}
