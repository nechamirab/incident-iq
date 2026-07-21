/**
 * Normalizes line endings (CRLF/CR -> LF) and trims trailing whitespace,
 * without altering meaningful content. Used to derive `normalizedContent`
 * from `originalContent` for every evidence item.
 *
 * @param text Raw, untrusted text (pasted or read from an uploaded file).
 * @returns The normalized text.
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}
