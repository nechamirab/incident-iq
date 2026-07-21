import type { EvidenceItem } from '../../../shared/types/evidence.js';
import { ApiError } from '../utils/ApiError.js';
import { createId } from '../utils/id.js';
import { normalizeLineEndings } from '../utils/normalizeText.js';

/**
 * Tokenizes RFC-4180-ish CSV text into rows of fields, honoring quoted
 * fields (which may contain commas, or escaped `""` quotes).
 *
 * @param content Normalized (LF-only) CSV text.
 * @returns Rows of raw field strings, in source order.
 */
function tokenizeCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parses an uploaded `.csv` file into one evidence item per data row,
 * using the first row as column headers. Content is only ever parsed as
 * delimited text -- never evaluated as code.
 *
 * @param content Raw, untrusted file text.
 * @param incidentId The incident this evidence belongs to.
 * @param sourceName Original uploaded file name.
 * @param createdAt ISO timestamp recorded as when this evidence was ingested.
 * @returns One evidence item per data row (excluding the header row).
 * @throws {ApiError} When the file has no header row at all.
 */
export function parseCsvContent(
  content: string,
  incidentId: string,
  sourceName: string,
  createdAt: string,
): EvidenceItem[] {
  const normalized = normalizeLineEndings(content);
  if (normalized.length === 0) {
    throw new ApiError(400, 'EMPTY_FILE', `"${sourceName}" is empty.`);
  }

  const rows = tokenizeCsv(normalized).filter(
    (row) => !(row.length === 1 && row[0]?.trim() === ''),
  );

  if (rows.length === 0) {
    throw new ApiError(400, 'EMPTY_FILE', `"${sourceName}" has no CSV rows.`);
  }

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((row, index) => {
    const record: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      record[header || `column_${columnIndex + 1}`] = (row[columnIndex] ?? '').trim();
    });

    const summary = headers
      .map((header, columnIndex) => `${header}: ${(row[columnIndex] ?? '').trim()}`)
      .join(' | ');

    return {
      id: createId('evidence'),
      incidentId,
      sourceType: 'uploaded-file',
      sourceName,
      originalContent: summary,
      normalizedContent: summary,
      timestamp: null,
      lineNumber: index + 2, // +1 for 1-based, +1 to account for the header row
      metadata: record,
      createdAt,
    };
  });
}
