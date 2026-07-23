/**
 * File-upload constraints shared by the frontend (client-side pre-validation
 * and UI copy) and the backend (Multer limits and authoritative validation).
 */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_FILES_PER_INCIDENT = 10;

export const ALLOWED_FILE_EXTENSIONS = ['.txt', '.log', '.json', '.csv'] as const;

export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];

/**
 * MIME types considered a legitimate match for each allowed extension.
 * Deliberately generous per extension (browsers and OSes are inconsistent
 * about exactly which MIME type they report for plain-text-ish files), and
 * combined with extension + parser-level validation rather than used as
 * the sole gate -- a MIME type alone is trivially spoofable and easily
 * wrong for reasons that have nothing to do with malicious intent (e.g. an
 * unregistered `.log` MIME type on some OS/browser combinations).
 */
export const EXPECTED_MIME_TYPES_BY_EXTENSION: Record<AllowedFileExtension, readonly string[]> = {
  '.txt': ['text/plain'],
  '.log': ['text/plain', 'text/x-log', 'application/octet-stream'],
  '.json': ['application/json', 'text/json', 'text/plain'],
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
};

/**
 * MIME types that are effectively "unknown" rather than a positive claim
 * about content type -- common when a browser/OS/tool doesn't recognize an
 * extension. These are never rejected on MIME grounds alone; extension and
 * parser validation remain the real gate for them.
 */
export const GENERIC_UNKNOWN_MIME_TYPES = ['application/octet-stream', ''] as const;
