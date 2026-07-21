import type { EvidenceItem } from '../../../shared/types/evidence.js';
import { ApiError } from '../utils/ApiError.js';
import { parseCsvContent } from './csvParser.js';
import { parseJsonContent } from './jsonParser.js';
import { parseTextContent } from './textParser.js';

export { parseCsvContent } from './csvParser.js';
export { parseJsonContent } from './jsonParser.js';
export { parseSingleBlock, parseTextContent } from './textParser.js';

export interface UploadedFileInput {
  originalName: string;
  buffer: Buffer;
}

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
}

/**
 * Dispatches an uploaded file to the parser matching its extension and
 * returns the evidence items it produces. The file buffer is only ever
 * decoded as UTF-8 text and handed to a text/JSON/CSV parser -- it is
 * never written to disk or executed.
 *
 * @param file The uploaded file's original name and raw buffer.
 * @param incidentId The incident this evidence belongs to.
 * @param createdAt ISO timestamp recorded as when this evidence was ingested.
 * @throws {ApiError} When the file extension is not supported, or the file
 * content does not match its expected format (invalid JSON/CSV).
 */
export function parseUploadedFile(
  file: UploadedFileInput,
  incidentId: string,
  createdAt: string,
): EvidenceItem[] {
  const extension = getExtension(file.originalName);
  const content = file.buffer.toString('utf-8');

  switch (extension) {
    case '.txt':
    case '.log':
      return parseTextContent(content, incidentId, 'uploaded-file', file.originalName, createdAt);
    case '.json':
      return parseJsonContent(content, incidentId, file.originalName, createdAt);
    case '.csv':
      return parseCsvContent(content, incidentId, file.originalName, createdAt);
    default:
      throw new ApiError(
        400,
        'UNSUPPORTED_FILE_TYPE',
        `"${file.originalName}" has an unsupported file type. Supported types: .txt, .log, .json, .csv.`,
      );
  }
}
