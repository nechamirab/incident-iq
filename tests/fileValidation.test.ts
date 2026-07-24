import { describe, expect, it } from 'vitest';
import {
  computeFileSubmissionError,
  isFileRelatedApiError,
  resolveFileSelection,
  validateSelectedFile,
} from '../src/utils/fileValidation';
import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_INCIDENT } from '../shared/constants/fileUpload';
import { ApiRequestError } from '../src/services/apiClient';

function buildFile(name: string, sizeBytes: number, type = ''): File {
  const content = sizeBytes > 0 ? new Uint8Array(sizeBytes) : new Uint8Array(0);
  return new File([content], name, { type });
}

function buildTextFile(name: string, content: string, type = ''): File {
  return new File([content], name, { type });
}

describe('validateSelectedFile', () => {
  it('accepts a .txt file within the size limit', async () => {
    expect(await validateSelectedFile(buildTextFile('notes.txt', 'log line one'))).toBeNull();
  });

  it('accepts every supported extension with real, non-blank content', async () => {
    expect(await validateSelectedFile(buildTextFile('a.txt', 'content'))).toBeNull();
    expect(await validateSelectedFile(buildTextFile('a.log', 'content'))).toBeNull();
    expect(await validateSelectedFile(buildTextFile('a.json', '{"ok":true}'))).toBeNull();
    expect(await validateSelectedFile(buildFile('a.csv', 100))).toBeNull();
  });

  it('rejects an unsupported extension', async () => {
    expect(await validateSelectedFile(buildFile('malware.exe', 100))).toMatch(/unsupported file type/i);
  });

  it('rejects a file with no extension', async () => {
    expect(await validateSelectedFile(buildFile('README', 100))).toMatch(/unsupported file type/i);
  });

  it('rejects a file larger than the size limit', async () => {
    expect(await validateSelectedFile(buildFile('big.txt', MAX_FILE_SIZE_BYTES + 1))).toMatch(
      /exceeds the/i,
    );
  });

  it('accepts a file exactly at the size limit', async () => {
    expect(await validateSelectedFile(buildFile('exact.txt', MAX_FILE_SIZE_BYTES))).toBeNull();
  });

  it('rejects a zero-byte empty file', async () => {
    expect(await validateSelectedFile(buildFile('empty.txt', 0))).toMatch(/is empty/i);
  });

  it('rejects a whitespace-only .txt file, even though its size is nonzero', async () => {
    const result = await validateSelectedFile(buildTextFile('spaces.txt', '   \n\t  \n'));
    expect(result).toMatch(/is empty/i);
  });

  it('rejects a whitespace-only .log file', async () => {
    const result = await validateSelectedFile(buildTextFile('spaces.log', '\n\n   '));
    expect(result).toMatch(/is empty/i);
  });

  it('accepts a .txt file whose content is only whitespace-adjacent but has real text', async () => {
    expect(await validateSelectedFile(buildTextFile('real.txt', '  actual content  '))).toBeNull();
  });

  it('rejects a .json file containing structurally invalid JSON', async () => {
    const result = await validateSelectedFile(buildTextFile('broken.json', '{ "unterminated": '));
    expect(result).toMatch(/not valid json/i);
  });

  it('accepts a .json file containing valid JSON', async () => {
    expect(await validateSelectedFile(buildTextFile('valid.json', '[{"a":1}]'))).toBeNull();
  });

  it('rejects a concrete MIME-type mismatch for the extension', async () => {
    const result = await validateSelectedFile(buildFile('notes.txt', 100, 'image/png'));
    expect(result).toMatch(/does not match its \.txt extension/i);
  });

  it('accepts a generic/unknown MIME type (browsers report these inconsistently)', async () => {
    expect(await validateSelectedFile(buildFile('notes.txt', 100, 'application/octet-stream'))).toBeNull();
    expect(await validateSelectedFile(buildFile('notes.txt', 100, ''))).toBeNull();
  });

  it('accepts the expected MIME type for each extension', async () => {
    expect(await validateSelectedFile(buildFile('notes.txt', 100, 'text/plain'))).toBeNull();
    expect(
      await validateSelectedFile(buildTextFile('data.json', '{"ok":true}', 'application/json')),
    ).toBeNull();
  });

  it('does not apply content-based structural validation to .csv (left to the backend)', async () => {
    // A CSV with an inconsistent column count would be rejected by the
    // backend's dedicated csvParser.ts, but is deliberately NOT
    // re-validated client-side (see fileValidation.ts's doc comment) --
    // this proves that choice, rather than asserting it stays silently true.
    const malformed = buildTextFile('malformed.csv', 'a,b,c\n1,2\n');
    expect(await validateSelectedFile(malformed)).toBeNull();
  });
});

describe('resolveFileSelection', () => {
  // `FileUploadZone.addFiles` calls this for both the file-picker's change
  // handler and the drag-and-drop handler -- exercising it directly here
  // covers both entry points, since neither adds any logic of its own on
  // top of this function's result.

  it('rejects an invalid (empty) file and accepts nothing', async () => {
    const result = await resolveFileSelection(0, [buildFile('spaces.txt', 0)]);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual(['"spaces.txt" is empty.']);
  });

  it('rejects a whitespace-only file and never adds it to the accepted list', async () => {
    const whitespaceOnly = buildTextFile('spaces.txt', '   \n  ');
    const result = await resolveFileSelection(0, [whitespaceOnly]);
    expect(result.accepted).not.toContain(whitespaceOnly);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual(['"spaces.txt" is empty.']);
  });

  it('accepts a valid file with no errors', async () => {
    const valid = buildTextFile('good.txt', 'real content');
    const result = await resolveFileSelection(0, [valid]);
    expect(result.accepted).toEqual([valid]);
    expect(result.errors).toEqual([]);
  });

  it("a later call for a valid file never carries over an earlier call's rejection error", async () => {
    // Simulates: user selects an invalid file (rejected), then separately
    // selects (or drops) a valid one -- each call to `resolveFileSelection`
    // is independent and the caller (FileUploadZone) always replaces its
    // error state wholesale with the latest result, so nothing from the
    // first call should appear in, or influence, the second.
    const firstAttempt = await resolveFileSelection(0, [buildFile('spaces.txt', 0)]);
    expect(firstAttempt.errors).toEqual(['"spaces.txt" is empty.']);

    const secondAttempt = await resolveFileSelection(0, [buildTextFile('good.txt', 'content')]);
    expect(secondAttempt.errors).toEqual([]);
    expect(secondAttempt.errors).not.toContain('"spaces.txt" is empty.');
    expect(secondAttempt.accepted).toHaveLength(1);
  });

  it('selecting another invalid file replaces the old message with the new one, not both', async () => {
    const firstAttempt = await resolveFileSelection(0, [buildFile('spaces.txt', 0)]);
    expect(firstAttempt.errors).toEqual(['"spaces.txt" is empty.']);

    const secondAttempt = await resolveFileSelection(0, [buildFile('malware.exe', 100)]);
    expect(secondAttempt.errors).toHaveLength(1);
    expect(secondAttempt.errors[0]).toMatch(/unsupported file type/i);
    expect(secondAttempt.errors).not.toContain('"spaces.txt" is empty.');
  });

  it('is a pure function: calling it again with the same invalid file re-validates fresh, with no memoized/stale result', async () => {
    const sameFileEachTime = () => buildFile('spaces.txt', 0);
    const first = await resolveFileSelection(0, [sameFileEachTime()]);
    const second = await resolveFileSelection(0, [sameFileEachTime()]);
    expect(first.errors).toEqual(second.errors);
    expect(first.accepted).toEqual(second.accepted);
    expect(first.errors).toEqual(['"spaces.txt" is empty.']);
  });

  it('accepts multiple valid candidates from a single drop/selection', async () => {
    const a = buildTextFile('a.txt', 'content a');
    const b = buildTextFile('b.log', 'content b');
    const result = await resolveFileSelection(0, [a, b]);
    expect(result.accepted).toEqual([a, b]);
    expect(result.errors).toEqual([]);
  });

  it('keeps only the valid files when a valid and an invalid (whitespace-only) file are selected together', async () => {
    const valid = buildTextFile('good.txt', 'content');
    const invalid = buildTextFile('spaces.txt', '   ');
    const result = await resolveFileSelection(0, [valid, invalid]);
    expect(result.accepted).toEqual([valid]);
    expect(result.accepted).not.toContain(invalid);
    expect(result.errors).toEqual(['"spaces.txt" is empty.']);
  });

  it('partitions a mixed batch into accepted files and per-file error messages', async () => {
    const valid = buildFile('good.txt', 10);
    const invalid = buildFile('empty.txt', 0);
    const result = await resolveFileSelection(0, [valid, invalid]);
    expect(result.accepted).toEqual([valid]);
    expect(result.errors).toEqual(['"empty.txt" is empty.']);
  });

  it('rejects candidates once the per-incident file limit is reached', async () => {
    const overflow = buildFile('overflow.txt', 10);
    const result = await resolveFileSelection(MAX_FILES_PER_INCIDENT, [overflow]);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual([
      `"overflow.txt" was not added: the ${MAX_FILES_PER_INCIDENT}-file limit was reached.`,
    ]);
  });

  it('returns an empty result for an empty candidate batch', async () => {
    const result = await resolveFileSelection(0, []);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});

describe('isFileRelatedApiError', () => {
  it.each(['EMPTY_FILE', 'INVALID_CSV_STRUCTURE', 'INVALID_JSON_FILE', 'UNSUPPORTED_FILE_TYPE', 'UNSUPPORTED_MIME_TYPE'])(
    'treats %s as file-related',
    (code) => {
      expect(isFileRelatedApiError(new ApiRequestError(code, 'message'))).toBe(true);
    },
  );

  it('does not treat an unrelated backend error code as file-related', () => {
    expect(isFileRelatedApiError(new ApiRequestError('VALIDATION_ERROR', 'Title is required.'))).toBe(false);
  });

  it('does not treat a generic Error (not an ApiRequestError) as file-related', () => {
    expect(isFileRelatedApiError(new Error('network down'))).toBe(false);
  });

  it('does not treat null/undefined as file-related', () => {
    expect(isFileRelatedApiError(null)).toBe(false);
    expect(isFileRelatedApiError(undefined)).toBe(false);
  });
});

describe('computeFileSubmissionError', () => {
  it('surfaces the message when the mutation failed with a file-related error', () => {
    const error = new ApiRequestError('EMPTY_FILE', '"spaces.txt" is empty.');
    expect(computeFileSubmissionError(true, error)).toBe('"spaces.txt" is empty.');
  });

  it('returns null (so the generic alert renders instead) for an unrelated backend error', () => {
    const error = new ApiRequestError('VALIDATION_ERROR', 'Title is required.');
    expect(computeFileSubmissionError(true, error)).toBeNull();
  });

  it('returns null when there is no error at all', () => {
    expect(computeFileSubmissionError(false, null)).toBeNull();
  });

  it('never produces both a file-selection message and a generic-alert message for the same error', () => {
    // This is the pure-logic guarantee behind "no duplicate file-validation
    // alerts are rendered": for any given mutation error, exactly one of
    // (FileUploadZone's externalError) / (the generic outer alert) will be
    // non-empty, never both.
    const fileError = new ApiRequestError('EMPTY_FILE', '"spaces.txt" is empty.');
    const genericError = new ApiRequestError('VALIDATION_ERROR', 'Title is required.');

    const fileResult = computeFileSubmissionError(true, fileError);
    const genericResult = computeFileSubmissionError(true, genericError);

    // File-related: FileUploadZone shows it, the generic alert (gated on
    // `!fileSubmissionError`) would not.
    expect(fileResult).not.toBeNull();
    // Unrelated: FileUploadZone shows nothing extra, the generic alert
    // (gated on `!fileSubmissionError`) still would.
    expect(genericResult).toBeNull();
  });
});
