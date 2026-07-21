import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from '../../shared/constants/fileUpload.js';
import { formatFileSize } from './formatFileSize.js';

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
}

/**
 * Validates a single file client-side before it is added to the upload
 * list, mirroring (but not replacing) the backend's authoritative checks.
 *
 * @param file The file the user selected.
 * @returns `null` if the file is acceptable, or a human-readable reason it
 * was rejected.
 */
export function validateSelectedFile(file: File): string | null {
  const extension = getExtension(file.name);
  if (!(ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(extension)) {
    return `"${file.name}" has an unsupported file type. Supported types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" is ${formatFileSize(file.size)}, which exceeds the ${formatFileSize(MAX_FILE_SIZE_BYTES)} limit.`;
  }

  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }

  return null;
}
