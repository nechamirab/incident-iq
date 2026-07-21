const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/**
 * Formats a byte count as a short, human-readable string (e.g. `"482 B"`,
 * `"12.3 KB"`, `"2.0 MB"`).
 *
 * @param bytes Non-negative byte count.
 * @returns A human-readable size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }

  const exponent = Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);
  const value = bytes / 2 ** (exponent * 10);
  const formatted = exponent === 0 ? value.toFixed(0) : value.toFixed(1);

  return `${formatted} ${UNITS[exponent]}`;
}
