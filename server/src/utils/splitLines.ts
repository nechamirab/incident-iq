import { normalizeLineEndings } from './normalizeText.js';

export interface TextLine {
  /** 1-based position of this line in the normalized source text. */
  lineNumber: number;
  content: string;
}

/**
 * Splits normalized text into its non-empty lines, preserving each line's
 * original 1-based position (blank lines are skipped but still counted),
 * so the reported line number always matches what a reader would see in
 * the source text or file.
 *
 * @param text Raw, untrusted text.
 * @returns Non-empty lines with their source line numbers.
 */
export function splitNonEmptyLines(text: string): TextLine[] {
  const normalized = normalizeLineEndings(text);
  if (normalized.length === 0) {
    return [];
  }

  return normalized
    .split('\n')
    .map((content, index) => ({ lineNumber: index + 1, content: content.trim() }))
    .filter((line) => line.content.length > 0);
}
