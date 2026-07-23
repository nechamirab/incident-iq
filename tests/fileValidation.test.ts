import { describe, expect, it } from 'vitest';
import { resolveFileSelection, validateSelectedFile } from '../src/utils/fileValidation';
import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_INCIDENT } from '../shared/constants/fileUpload';

function buildFile(name: string, sizeBytes: number): File {
  const content = sizeBytes > 0 ? new Uint8Array(sizeBytes) : new Uint8Array(0);
  return new File([content], name);
}

describe('validateSelectedFile', () => {
  it('accepts a .txt file within the size limit', () => {
    expect(validateSelectedFile(buildFile('notes.txt', 100))).toBeNull();
  });

  it('accepts every supported extension', () => {
    for (const name of ['a.txt', 'a.log', 'a.json', 'a.csv']) {
      expect(validateSelectedFile(buildFile(name, 100))).toBeNull();
    }
  });

  it('rejects an unsupported extension', () => {
    expect(validateSelectedFile(buildFile('malware.exe', 100))).toMatch(/unsupported file type/i);
  });

  it('rejects a file with no extension', () => {
    expect(validateSelectedFile(buildFile('README', 100))).toMatch(/unsupported file type/i);
  });

  it('rejects a file larger than the size limit', () => {
    expect(validateSelectedFile(buildFile('big.txt', MAX_FILE_SIZE_BYTES + 1))).toMatch(
      /exceeds the/i,
    );
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateSelectedFile(buildFile('exact.txt', MAX_FILE_SIZE_BYTES))).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(validateSelectedFile(buildFile('empty.txt', 0))).toMatch(/is empty/i);
  });
});

describe('resolveFileSelection', () => {
  // `FileUploadZone.addFiles` calls this for both the file-picker's change
  // handler and the drag-and-drop handler -- exercising it directly here
  // covers both entry points, since neither adds any logic of its own on
  // top of this function's result.

  it('rejects an invalid (empty) file and accepts nothing', () => {
    const result = resolveFileSelection(0, [buildFile('spaces.txt', 0)]);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual(['"spaces.txt" is empty.']);
  });

  it('accepts a valid file with no errors', () => {
    const valid = buildFile('good.txt', 100);
    const result = resolveFileSelection(0, [valid]);
    expect(result.accepted).toEqual([valid]);
    expect(result.errors).toEqual([]);
  });

  it('a later call for a valid file never carries over an earlier call\'s rejection error', () => {
    // Simulates: user selects an invalid file (rejected), then separately
    // selects (or drops) a valid one -- each call to `resolveFileSelection`
    // is independent and the caller (FileUploadZone) always replaces its
    // error state wholesale with the latest result, so nothing from the
    // first call should appear in, or influence, the second.
    const firstAttempt = resolveFileSelection(0, [buildFile('spaces.txt', 0)]);
    expect(firstAttempt.errors).toEqual(['"spaces.txt" is empty.']);

    const secondAttempt = resolveFileSelection(0, [buildFile('good.txt', 100)]);
    expect(secondAttempt.errors).toEqual([]);
    expect(secondAttempt.errors).not.toContain('"spaces.txt" is empty.');
    expect(secondAttempt.accepted).toHaveLength(1);
  });

  it('selecting another invalid file replaces the old message with the new one, not both', () => {
    const firstAttempt = resolveFileSelection(0, [buildFile('spaces.txt', 0)]);
    expect(firstAttempt.errors).toEqual(['"spaces.txt" is empty.']);

    const secondAttempt = resolveFileSelection(0, [buildFile('malware.exe', 100)]);
    expect(secondAttempt.errors).toHaveLength(1);
    expect(secondAttempt.errors[0]).toMatch(/unsupported file type/i);
    expect(secondAttempt.errors).not.toContain('"spaces.txt" is empty.');
  });

  it('accepts multiple valid candidates from a single drop/selection', () => {
    const a = buildFile('a.txt', 10);
    const b = buildFile('b.log', 10);
    const result = resolveFileSelection(0, [a, b]);
    expect(result.accepted).toEqual([a, b]);
    expect(result.errors).toEqual([]);
  });

  it('partitions a mixed batch into accepted files and per-file error messages', () => {
    const valid = buildFile('good.txt', 10);
    const invalid = buildFile('empty.txt', 0);
    const result = resolveFileSelection(0, [valid, invalid]);
    expect(result.accepted).toEqual([valid]);
    expect(result.errors).toEqual(['"empty.txt" is empty.']);
  });

  it('rejects candidates once the per-incident file limit is reached', () => {
    const overflow = buildFile('overflow.txt', 10);
    const result = resolveFileSelection(MAX_FILES_PER_INCIDENT, [overflow]);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual([
      `"overflow.txt" was not added: the ${MAX_FILES_PER_INCIDENT}-file limit was reached.`,
    ]);
  });

  it('returns an empty result for an empty candidate batch', () => {
    const result = resolveFileSelection(0, []);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
