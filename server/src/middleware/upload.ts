import multer from 'multer';
import {
  ALLOWED_FILE_EXTENSIONS,
  EXPECTED_MIME_TYPES_BY_EXTENSION,
  GENERIC_UNKNOWN_MIME_TYPES,
  MAX_FILES_PER_INCIDENT,
  MAX_FILE_SIZE_BYTES,
  type AllowedFileExtension,
} from '../../../shared/constants/fileUpload.js';
import { ApiError } from '../utils/ApiError.js';

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
}

function isAllowedExtension(extension: string): extension is AllowedFileExtension {
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Whether `mimetype` is an acceptable match for `extension` -- true if it's
 * one of that extension's expected types, or a generic/unknown type no
 * browser/OS combination should be penalized for reporting. Extension and
 * (for text/JSON/CSV) parser-level validation remain the authoritative
 * checks; this only catches a *concrete* mismatch (e.g. an image uploaded
 * with a `.txt` name), never a merely-unfamiliar-but-plausible one.
 */
function isAcceptableMimeType(extension: AllowedFileExtension, mimetype: string): boolean {
  if ((GENERIC_UNKNOWN_MIME_TYPES as readonly string[]).includes(mimetype)) {
    return true;
  }
  return EXPECTED_MIME_TYPES_BY_EXTENSION[extension].includes(mimetype);
}

/**
 * Multer middleware for incident evidence uploads. Files are kept in
 * memory only (never written to disk, so an uploaded file name can never
 * influence a server filesystem path) and are rejected up front if their
 * extension is not on the allow-list or their MIME type is a concrete
 * mismatch for that extension, before any parsing is attempted.
 */
export const incidentEvidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_INCIDENT,
  },
  fileFilter: (_req, file, callback) => {
    const extension = getExtension(file.originalname);
    if (!isAllowedExtension(extension)) {
      callback(
        new ApiError(
          400,
          'UNSUPPORTED_FILE_TYPE',
          `"${file.originalname}" has an unsupported file type. Supported types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`,
        ),
      );
      return;
    }

    if (!isAcceptableMimeType(extension, file.mimetype)) {
      callback(
        new ApiError(
          400,
          'UNSUPPORTED_MIME_TYPE',
          `"${file.originalname}" was uploaded as "${file.mimetype}", which does not match its ` +
            `${extension} extension. If this is genuinely a ${extension} file, try re-saving or ` +
            're-exporting it before uploading again.',
        ),
      );
      return;
    }

    callback(null, true);
  },
});
