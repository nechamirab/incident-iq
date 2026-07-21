import type { AIPrompt } from '../providers/AIProvider.js';

/** Version identifier recorded when a repair prompt was needed for a run. */
export const REPAIR_INVALID_JSON_PROMPT_VERSION = 'repair-invalid-json-v1';

const MAX_PREVIOUS_RESPONSE_CHARS = 4000;

/**
 * Purpose: a one-shot correction prompt used when the model's response to
 * {@link buildIncidentAnalysisPrompt} either was not valid JSON, or was
 * valid JSON that failed schema validation. Reuses the original analysis
 * prompt's system message (the rules and target shape do not change) and
 * asks specifically for a corrected version of the previous response.
 *
 * Expected input: the original prompt, the model's invalid previous
 * response, and a human-readable description of what was wrong with it
 * (a JSON parse error message, or the list of Zod validation issues).
 * Expected output: the same JSON shape as `incident-analysis-v1`.
 *
 * This is attempted exactly once per analysis run -- if the corrected
 * response is still invalid, the run fails with a controlled error rather
 * than retrying indefinitely.
 */
export function buildRepairPrompt(
  originalPrompt: AIPrompt,
  previousResponse: string,
  validationIssues: string,
): AIPrompt {
  const truncatedResponse =
    previousResponse.length > MAX_PREVIOUS_RESPONSE_CHARS
      ? `${previousResponse.slice(0, MAX_PREVIOUS_RESPONSE_CHARS)}... (truncated)`
      : previousResponse;

  return {
    system: originalPrompt.system,
    user: [
      'Your previous response to the request below could not be used because it failed validation.',
      '',
      `Validation issue(s): ${validationIssues}`,
      '',
      'Your previous response was:',
      truncatedResponse,
      '',
      'Return a corrected response now. Output ONLY a single valid JSON object matching the exact ' +
        'shape described in the system prompt -- no markdown code fences, no commentary, no ' +
        'explanation of what you changed.',
      '',
      'For reference, the original request was:',
      originalPrompt.user,
    ].join('\n'),
  };
}
