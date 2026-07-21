/**
 * Renders a confidence score (0-100) as a short text descriptor, so
 * confidence is never communicated by a number or color alone. Thresholds
 * are intentionally coarse -- this is an investigation aid, not a precise
 * probability.
 */
export function getConfidenceDescriptor(confidence: number): string {
  if (confidence < 40) {
    return 'Low confidence';
  }
  if (confidence < 70) {
    return 'Moderate confidence';
  }
  return 'High confidence';
}
