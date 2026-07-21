import { describe, expect, it } from 'vitest';
import { validateSelectedFile } from '../src/utils/fileValidation';
import { MAX_FILE_SIZE_BYTES } from '../shared/constants/fileUpload';

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
