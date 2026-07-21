import { describe, expect, it } from 'vitest';
import { formatFileSize } from '../src/utils/formatFileSize';

describe('formatFileSize', () => {
  it('formats zero and negative sizes as 0 B', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(-5)).toBe('0 B');
  });

  it('formats byte-scale sizes without a decimal', () => {
    expect(formatFileSize(482)).toBe('482 B');
  });

  it('formats kilobyte-scale sizes with one decimal', () => {
    expect(formatFileSize(12_300)).toBe('12.0 KB');
  });

  it('formats megabyte-scale sizes with one decimal', () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
