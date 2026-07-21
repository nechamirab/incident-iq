import type { EvidenceItem } from '../../../shared/types/evidence.js';
import { ApiError } from '../utils/ApiError.js';
import { createId } from '../utils/id.js';

const TIMESTAMP_KEY_CANDIDATES = ['timestamp', 'time', 'ts', 'date', 'datetime'];
const MAX_ARRAY_ITEMS = 2000;

function extractTimestamp(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!TIMESTAMP_KEY_CANDIDATES.includes(key.toLowerCase())) {
      continue;
    }

    const candidate = record[key];
    if (typeof candidate !== 'string' && typeof candidate !== 'number') {
      continue;
    }

    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

/**
 * Parses an uploaded `.json` file into one evidence item per array element
 * (for a JSON array, e.g. an array of log records), or a single evidence
 * item for a top-level JSON object or primitive. Content is only ever
 * parsed with `JSON.parse` -- never evaluated as code.
 *
 * @param content Raw, untrusted file text.
 * @param incidentId The incident this evidence belongs to.
 * @param sourceName Original uploaded file name.
 * @param createdAt ISO timestamp recorded as when this evidence was ingested.
 * @returns One evidence item per array element, or a single item otherwise.
 * @throws {ApiError} When the content is not valid JSON.
 */
export function parseJsonContent(
  content: string,
  incidentId: string,
  sourceName: string,
  createdAt: string,
): EvidenceItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ApiError(
      400,
      'INVALID_JSON_FILE',
      `"${sourceName}" is not valid JSON and could not be parsed.`,
    );
  }

  const buildItem = (value: unknown, lineNumber: number | null): EvidenceItem => ({
    id: createId('evidence'),
    incidentId,
    sourceType: 'uploaded-file',
    sourceName,
    originalContent: JSON.stringify(value),
    normalizedContent: JSON.stringify(value),
    timestamp: extractTimestamp(value),
    lineNumber,
    metadata: {},
    createdAt,
  });

  if (Array.isArray(parsed)) {
    return parsed.slice(0, MAX_ARRAY_ITEMS).map((item, index) => buildItem(item, index + 1));
  }

  return [buildItem(parsed, null)];
}
