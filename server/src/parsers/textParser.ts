import type { EvidenceItem, EvidenceSourceType } from '../../../shared/types/evidence.js';
import { createId } from '../utils/id.js';
import { normalizeLineEndings } from '../utils/normalizeText.js';
import { splitNonEmptyLines } from '../utils/splitLines.js';

const LEADING_TIMESTAMP_PATTERN = /^\[([^\]]+)\]\s*/;

interface ExtractedTimestamp {
  timestamp: string | null;
  content: string;
}

/**
 * Recognizes and strips a leading bracketed timestamp prefix (e.g.
 * `"[2026-06-14T14:28:00Z] "`), returning the ISO timestamp it encodes and
 * the remaining content with the prefix removed. If there is no bracketed
 * prefix, or its contents don't parse as a date, the content is returned
 * unchanged and `timestamp` is `null`.
 *
 * This is the mechanism that lets a pasted evidence line carry an exact
 * timestamp (`EVIDENCE_TEXT_FIELDS`' helper text documents the convention
 * for users), and how `buildFormValuesFromIncident` (frontend) round-trips
 * a sample incident's evidence timestamps through the New Incident form's
 * plain-text fields when prefilling from "Load sample incident" -- without
 * it, evidence reconstructed from a loaded sample would always lose its
 * timestamps and produce an empty Timeline once re-analyzed.
 */
function extractLeadingTimestamp(content: string): ExtractedTimestamp {
  const match = LEADING_TIMESTAMP_PATTERN.exec(content);
  if (!match) {
    return { timestamp: null, content };
  }

  const candidate = new Date(match[1]);
  if (Number.isNaN(candidate.getTime())) {
    return { timestamp: null, content };
  }

  return { timestamp: candidate.toISOString(), content: content.slice(match[0].length) };
}

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
  return splitNonEmptyLines(content).map((line) => {
    const { timestamp, content: lineContent } = extractLeadingTimestamp(line.content);

    return {
      id: createId('evidence'),
      incidentId,
      sourceType,
      sourceName,
      originalContent: lineContent,
      normalizedContent: normalizeLineEndings(lineContent),
      timestamp,
      lineNumber: line.lineNumber,
      metadata: {},
      createdAt,
    };
  });
}

/**
 * Parses free-form prose (the incident description) as a single evidence
 * item, unlike {@link parseTextContent} which treats its input as
 * line-oriented log data. Also recognizes a leading bracketed timestamp
 * prefix (see {@link extractLeadingTimestamp}). Returns an empty array for
 * blank input.
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

  const { timestamp, content: strippedNormalized } = extractLeadingTimestamp(normalized);
  const { content: strippedOriginal } = extractLeadingTimestamp(content.trim());

  return [
    {
      id: createId('evidence'),
      incidentId,
      sourceType,
      sourceName,
      originalContent: strippedOriginal,
      normalizedContent: strippedNormalized,
      timestamp,
      lineNumber: null,
      metadata: {},
      createdAt,
    },
  ];
}
