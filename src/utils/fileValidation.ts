import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_INCIDENT,
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

/** The outcome of validating one newly selected/dropped batch of candidate files. */
export interface FileSelectionOutcome {
  /** Candidates that passed validation and fit within the remaining per-incident file budget, in the order given. */
  accepted: File[];
  /** Human-readable rejection reasons for this batch only -- never merged with a previous call's errors. */
  errors: string[];
}

/**
 * Pure decision logic for one batch of newly selected or dropped candidate
 * files: validates each with {@link validateSelectedFile} and enforces the
 * per-incident file-count limit, given how many files are already selected.
 *
 * Always returns a **fresh** `errors` array describing only this batch --
 * the single source of truth `FileUploadZone` replaces its previous
 * rejection-error state with wholesale, never merges. This is what
 * guarantees a rejection message about an earlier, now-irrelevant
 * selection attempt can never survive a new one: there is no code path
 * that appends to or retains a prior call's errors.
 *
 * @param currentFileCount How many files are already selected for this incident.
 * @param candidates The newly selected/dropped files to validate.
 */
export function resolveFileSelection(
  currentFileCount: number,
  candidates: readonly File[],
): FileSelectionOutcome {
  const errors: string[] = [];
  const accepted: File[] = [];
  let remainingSlots = MAX_FILES_PER_INCIDENT - currentFileCount;

  for (const candidate of candidates) {
    if (remainingSlots <= 0) {
      errors.push(
        `"${candidate.name}" was not added: the ${MAX_FILES_PER_INCIDENT}-file limit was reached.`,
      );
      continue;
    }

    const reason = validateSelectedFile(candidate);
    if (reason) {
      errors.push(reason);
      continue;
    }

    accepted.push(candidate);
    remainingSlots -= 1;
  }

  return { accepted, errors };
}
