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
 * @throws {ApiError} When the file is empty, has no header row, has empty
 * or duplicate headers, or contains a data row whose column count doesn't
 * match the header row (a strong signal the file wasn't parsed as
 * intended, e.g. an unescaped comma or an inconsistent export).
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

  const rawRows = tokenizeCsv(normalized);
  if (rawRows.length === 0) {
    throw new ApiError(400, 'EMPTY_FILE', `"${sourceName}" has no CSV rows.`);
  }

  // The header row is read as-is (even if blank -- that's a real, reportable
  // structural problem, checked next), but a "completely empty" *data* row
  // is any row whose fields are all blank after trimming, not just a row
  // that tokenized to a single empty field (e.g. a stray line of only
  // commas, "  ,  ,  ").
  const headers = rawRows[0].map((header) => header.trim());

  if (headers.every((header) => header === '')) {
    throw new ApiError(400, 'INVALID_CSV_STRUCTURE', `"${sourceName}" has no meaningful column headers.`);
  }

  const nonEmptyHeaders = headers.filter((header) => header !== '');
  const duplicateHeaders = nonEmptyHeaders.filter(
    (header, index) => nonEmptyHeaders.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    throw new ApiError(
      400,
      'INVALID_CSV_STRUCTURE',
      `"${sourceName}" has duplicate column headers: ${Array.from(new Set(duplicateHeaders)).join(', ')}.`,
    );
  }

  const dataRows = rawRows.slice(1).filter((row) => !row.every((field) => field.trim() === ''));
  const malformedRowIndex = dataRows.findIndex((row) => row.length !== headers.length);
  if (malformedRowIndex !== -1) {
    const malformedRow = dataRows[malformedRowIndex];
    throw new ApiError(
      400,
      'INVALID_CSV_STRUCTURE',
      `"${sourceName}" row ${malformedRowIndex + 2} has ${malformedRow.length} column(s), but the ` +
        `header row has ${headers.length}. Every row must have the same number of columns as the header.`,
    );
  }

  if (dataRows.length === 0) {
    throw new ApiError(400, 'EMPTY_FILE', `"${sourceName}" has no CSV data rows.`);
  }

  return dataRows.map((row, index) => {
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
