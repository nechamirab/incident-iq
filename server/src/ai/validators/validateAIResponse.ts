import { AiAnalysisResponseSchema, type AiAnalysisResponse } from '../schemas/aiAnalysisResponse.schema.js';

export type AIResponseValidation =
  | { success: true; data: AiAnalysisResponse }
  | { success: false; issues: string };

const CODE_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

/**
 * Strips a wrapping markdown code fence (```` ```json ... ``` ````) if the
 * model added one despite instructions not to, and trims surrounding
 * whitespace/commentary the model may have added around the JSON object.
 */
function extractJsonPayload(rawText: string): string {
  const trimmed = rawText.trim();
  const fenceMatch = CODE_FENCE_PATTERN.exec(trimmed);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

/**
 * Validates a raw AI provider response: extracts a JSON payload from the
 * text (tolerating a wrapping markdown code fence), parses it, and checks
 * it against {@link AiAnalysisResponseSchema}. Never throws -- callers use
 * the discriminated result to decide whether to retry.
 *
 * @param rawText The provider's raw text response.
 */
export function validateAIResponse(rawText: string): AIResponseValidation {
  const jsonPayload = extractJsonPayload(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'unknown JSON parse error';
    return { success: false, issues: `Response was not valid JSON: ${message}` };
  }

  const result = AiAnalysisResponseSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { success: false, issues };
  }

  return { success: true, data: result.data };
}
