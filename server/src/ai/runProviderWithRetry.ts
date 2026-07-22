import type { Incident } from '../../../shared/types/incident.js';
import { buildRepairPrompt } from './prompts/repairInvalidJsonV1.js';
import type { AICompletionContext, AIPrompt, AIProvider } from './providers/AIProvider.js';
import type { StructuredResponseValidation } from './validators/validateAIResponse.js';
import { ApiError } from '../utils/ApiError.js';

export interface RetryableCallResult<T> {
  data: T;
  rawText: string;
  repaired: boolean;
  promptVersionUsed: string;
  durationMs: number;
}

export interface RunProviderWithRetryParams<T> {
  incident: Incident;
  provider: AIProvider;
  /** Extra structured data the provider needs beyond the incident (e.g. the run being reviewed). */
  context?: AICompletionContext;
  buildPrompt: () => AIPrompt;
  validate: (rawText: string) => StructuredResponseValidation<T>;
  /** Recorded as the run/review's `promptVersion` when the first attempt succeeds. */
  promptVersion: string;
  /** Recorded as the run/review's `promptVersion` when a repair attempt was needed. */
  repairPromptVersion: string;
  invalidErrorCode: string;
  invalidErrorMessage: string;
}

/**
 * Calls the provider, validates its response, and -- if validation fails
 * (invalid JSON, or JSON that doesn't match the required schema) -- retries
 * exactly once with a repair prompt describing what was wrong. Throws a
 * controlled {@link ApiError} if the response is still invalid after the
 * retry; a malformed response is never returned to the caller.
 *
 * Shared by every AI orchestration service (`analysisService`,
 * `skepticReviewService`, and any future one) so the retry contract stays
 * identical across prompt types.
 */
export async function runProviderWithRetry<T>(
  params: RunProviderWithRetryParams<T>,
): Promise<RetryableCallResult<T>> {
  const startedAt = Date.now();
  const prompt = params.buildPrompt();

  const firstRawText = await params.provider.complete(params.incident, prompt, params.context);
  const firstValidation = params.validate(firstRawText);
  if (firstValidation.success) {
    return {
      data: firstValidation.data,
      rawText: firstRawText,
      repaired: false,
      promptVersionUsed: params.promptVersion,
      durationMs: Date.now() - startedAt,
    };
  }

  const repairPrompt = buildRepairPrompt(prompt, firstRawText, firstValidation.issues);
  const secondRawText = await params.provider.complete(params.incident, repairPrompt, params.context);
  const secondValidation = params.validate(secondRawText);
  if (secondValidation.success) {
    return {
      data: secondValidation.data,
      rawText: secondRawText,
      repaired: true,
      promptVersionUsed: params.repairPromptVersion,
      durationMs: Date.now() - startedAt,
    };
  }

  throw new ApiError(502, params.invalidErrorCode, params.invalidErrorMessage, {
    firstAttemptIssues: firstValidation.issues,
    secondAttemptIssues: secondValidation.issues,
  });
}
