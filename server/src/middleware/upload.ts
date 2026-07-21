import multer from 'multer';
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILES_PER_INCIDENT,
  MAX_FILE_SIZE_BYTES,
} from '../../../shared/constants/fileUpload.js';
import { ApiError } from '../utils/ApiError.js';

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
}

const allowedExtensions: readonly string[] = ALLOWED_FILE_EXTENSIONS;

/**
 * Multer middleware for incident evidence uploads. Files are kept in
 * memory only (never written to disk, so an uploaded file name can never
 * influence a server filesystem path) and are rejected up front if their
 * extension is not on the allow-list, before any parsing is attempted.
 */
export const incidentEvidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_INCIDENT,
  },
  fileFilter: (_req, file, callback) => {
    const extension = getExtension(file.originalname);
    if (!allowedExtensions.includes(extension)) {
      callback(
        new ApiError(
          400,
          'UNSUPPORTED_FILE_TYPE',
          `"${file.originalname}" has an unsupported file type. Supported types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`,
        ),
      );
      return;
    }
    callback(null, true);
  },
});
