import {
  ALLOWED_FILE_EXTENSIONS,
  EXPECTED_MIME_TYPES_BY_EXTENSION,
  GENERIC_UNKNOWN_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_INCIDENT,
  type AllowedFileExtension,
} from '../../shared/constants/fileUpload.js';
import { ApiRequestError } from '../services/apiClient.js';
import { formatFileSize } from './formatFileSize.js';

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
}

function isAllowedExtension(extension: string): extension is AllowedFileExtension {
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Mirrors the backend's `isAcceptableMimeType` (`server/src/middleware/upload.ts`):
 * true for an expected match for this extension, or a generic/unknown type
 * no browser/OS combination should be penalized for reporting.
 */
function isAcceptableMimeType(extension: AllowedFileExtension, mimeType: string): boolean {
  if ((GENERIC_UNKNOWN_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return true;
  }
  return EXPECTED_MIME_TYPES_BY_EXTENSION[extension].includes(mimeType);
}

const TEXT_LIKE_EXTENSIONS: readonly AllowedFileExtension[] = ['.txt', '.log'];

/** Everything about a file that can be checked without reading its content. */
function validateFileMetadata(file: File): string | null {
  const extension = getExtension(file.name);
  if (!isAllowedExtension(extension)) {
    return `"${file.name}" has an unsupported file type. Supported types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`;
  }

  if (!isAcceptableMimeType(extension, file.type)) {
    return (
      `"${file.name}" was selected as "${file.type}", which does not match its ${extension} ` +
      `extension. If this is genuinely a ${extension} file, try re-saving or re-exporting it ` +
      'before selecting it again.'
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" is ${formatFileSize(file.size)}, which exceeds the ${formatFileSize(MAX_FILE_SIZE_BYTES)} limit.`;
  }

  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }

  return null;
}

/**
 * Content-level checks reachable only by actually reading the file --
 * whitespace-only text/log content, and structurally invalid JSON. CSV
 * structure is deliberately **not** re-validated here: it already has a
 * dedicated, RFC-4180-aware tokenizer/validator on the backend
 * (`server/src/parsers/csvParser.ts`), and duplicating that parsing logic
 * client-side would be exactly the kind of duplicated validation
 * architecture this module is meant to avoid. A malformed CSV is still
 * caught -- just authoritatively, by the backend, on submission.
 */
async function validateFileContent(file: File): Promise<string | null> {
  const extension = getExtension(file.name);

  if ((TEXT_LIKE_EXTENSIONS as readonly string[]).includes(extension)) {
    const text = await file.text();
    return text.trim().length === 0 ? `"${file.name}" is empty.` : null;
  }

  if (extension === '.json') {
    const text = await file.text();
    try {
      JSON.parse(text);
      return null;
    } catch {
      return `"${file.name}" is not valid JSON.`;
    }
  }

  return null;
}

/**
 * Validates a single file client-side before it is added to the upload
 * list, mirroring (but not replacing) the backend's authoritative checks.
 * Async because catching a whitespace-only text/log file or malformed JSON
 * requires actually reading the file's content, not just its metadata --
 * without this, a file like a whitespace-only `spaces.txt` would pass
 * client-side validation, be silently accepted into the selected-files
 * list, and only be rejected later by the backend on submission, as a
 * separate, unsynchronized error.
 *
 * @param file The file the user selected.
 * @returns `null` if the file is acceptable, or a human-readable reason it was rejected.
 */
export async function validateSelectedFile(file: File): Promise<string | null> {
  const metadataIssue = validateFileMetadata(file);
  if (metadataIssue) {
    return metadataIssue;
  }
  return validateFileContent(file);
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
 * Candidates are validated in order (not in parallel) so the file-count
 * budget is enforced deterministically and error ordering matches selection
 * order.
 *
 * Always returns a **fresh** `errors` array describing only this batch --
 * the single source of truth, `FileUploadZone`, replaces its previous
 * rejection-error state with this result wholesale, never merges. This is
 * what guarantees a rejection message about an earlier, now-irrelevant
 * selection attempt can never survive a new one: there is no code path
 * that appends to or retains a prior call's errors. An invalid candidate is
 * never included in `accepted`, so it can never reach the selected-files
 * list in the first place.
 *
 * @param currentFileCount How many files are already selected for this incident.
 * @param candidates The newly selected/dropped files to validate.
 */
export async function resolveFileSelection(
  currentFileCount: number,
  candidates: readonly File[],
): Promise<FileSelectionOutcome> {
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

    const reason = await validateSelectedFile(candidate);
    if (reason) {
      errors.push(reason);
      continue;
    }

    accepted.push(candidate);
    remainingSlots -= 1;
  }

  return { accepted, errors };
}

/**
 * Every backend error code that means "an uploaded file itself was the
 * problem" (see `server/src/parsers/`, `server/src/middleware/upload.ts`) --
 * as opposed to an incident-field validation problem, a network failure, or
 * any other backend error.
 */
const FILE_RELATED_API_ERROR_CODES: ReadonlySet<string> = new Set([
  'EMPTY_FILE',
  'INVALID_CSV_STRUCTURE',
  'INVALID_JSON_FILE',
  'UNSUPPORTED_FILE_TYPE',
  'UNSUPPORTED_MIME_TYPE',
]);

/**
 * Whether a failed incident-creation request failed specifically because of
 * an uploaded file, rather than for some other reason. Used so a
 * file-related backend error is shown exactly once -- inside
 * `FileUploadZone`, alongside any client-side rejection message -- instead
 * of being duplicated as a second, generic form-level alert that could
 * disagree with (or simply repeat) what `FileUploadZone` already shows.
 *
 * @param error The error thrown by the incident-creation request, if any.
 */
export function isFileRelatedApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && FILE_RELATED_API_ERROR_CODES.has(error.code);
}

/**
 * The single decision of which error (if any) a failed incident-creation
 * mutation should surface as a file-selection error inside `FileUploadZone`.
 * `NewIncidentForm` uses this same result to also decide whether to
 * suppress its own generic alert (`!fileSubmissionError`) -- since both
 * checks read from this one function, a file-related error and the generic
 * alert can never both be non-empty for the same failure, which is what
 * guarantees exactly one file-validation alert is ever rendered.
 *
 * @param mutationIsError Whether the incident-creation mutation currently holds an error.
 * @param mutationError The mutation's error value, if any.
 */
export function computeFileSubmissionError(mutationIsError: boolean, mutationError: Error | null): string | null {
  return mutationIsError && isFileRelatedApiError(mutationError) ? mutationError.message : null;
}
