/**
 * File-upload constraints shared by the frontend (client-side pre-validation
 * and UI copy) and the backend (Multer limits and authoritative validation).
 */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_FILES_PER_INCIDENT = 10;

export const ALLOWED_FILE_EXTENSIONS = ['.txt', '.log', '.json', '.csv'] as const;

export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];
