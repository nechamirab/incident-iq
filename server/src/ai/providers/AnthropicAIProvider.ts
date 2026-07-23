import Anthropic, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import type { AiProviderName } from '../../../../shared/types/analysisRun.js';
import type { Incident } from '../../../../shared/types/incident.js';
import { redactPromptForExternalProvider } from '../redactSensitiveContent.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AICompletionContext, AIPrompt, AIProvider } from './AIProvider.js';

const MAX_OUTPUT_TOKENS = 4096;

/**
 * How many times the Anthropic SDK retries a request on its own (network
 * errors, `429`, `5xx`) before giving up and letting `complete()` throw.
 * Explicit rather than relying on the SDK's implicit default, so the retry
 * budget for transient provider failures is a visible, intentional choice
 * documented in one place -- this is the project's retry policy for
 * *transport*-level failures, distinct from `runProviderWithRetry`'s
 * one-shot repair retry for malformed *output*, which is a completely
 * separate concern layered on top of this.
 */
const MAX_TRANSPORT_RETRIES = 2;

interface AnthropicApiErrorLike {
  status?: number;
  message: string;
}

/** Only ever non-secret fields from an Anthropic SDK error -- never its `headers` (which can carry the request's Authorization header) or any other raw request/response data. */
function toSafeErrorDetails(error: AnthropicApiErrorLike): { status: number | undefined; message: string } {
  return { status: error.status, message: error.message };
}

/**
 * Real AI provider backed by the Anthropic Messages API. Used when
 * `AI_PROVIDER=anthropic` (directly, or when this exact class is what
 * `createAIProvider` builds because a key is configured). The API key is
 * read from `ANTHROPIC_API_KEY` on the backend only -- it is never exposed
 * to the frontend, logged, or included in any thrown error's message or
 * details.
 *
 * The key is checked lazily, on the first call to {@link complete}, rather
 * than at construction/startup time: a missing key must produce a clear,
 * catchable configuration error for that one request, not crash the whole
 * server process (which would also take down `/api/health`, the one place
 * an operator could otherwise see *why* AI requests are failing).
 */
export class AnthropicAIProvider implements AIProvider {
  readonly name = 'anthropic' as const;
  readonly model: string;
  readonly configuredProvider: AiProviderName = 'anthropic';
  readonly fallbackUsed = false;
  readonly fallbackReason = null;
  /** Not currently extracted from the Anthropic SDK response -- out of scope for this provider today. */
  readonly providerRequestId = null;

  private readonly client: Anthropic | null;
  private verified = false;
  private lastRedactionApplied = false;
  private lastRedactedValueCount = 0;
  private lastRedactionCategories: readonly string[] = [];

  constructor(apiKey: string | undefined, model: string) {
    this.model = model;
    this.client = apiKey
      ? new Anthropic({ apiKey, maxRetries: MAX_TRANSPORT_RETRIES })
      : null;
  }

  get providerVerified(): boolean {
    return this.verified;
  }

  get redactionApplied(): boolean {
    return this.lastRedactionApplied;
  }

  get redactedValueCount(): number {
    return this.lastRedactedValueCount;
  }

  get redactionCategories(): readonly string[] {
    return this.lastRedactionCategories;
  }

  async complete(_incident: Incident, prompt: AIPrompt, _context?: AICompletionContext): Promise<string> {
    if (!this.client) {
      throw new ApiError(
        503,
        'AI_PROVIDER_NOT_CONFIGURED',
        'AI_PROVIDER is set to "anthropic" but ANTHROPIC_API_KEY is not configured. Either set ' +
          'ANTHROPIC_API_KEY in your .env file, or set AI_PROVIDER=mock to use the offline mock ' +
          'provider for local development.',
      );
    }

    // Redact only the payload actually sent externally -- `prompt` (and the
    // incident/evidence it was built from) is never mutated, so local
    // storage and every other consumer of `prompt` still see the original,
    // unredacted text.
    const redaction = redactPromptForExternalProvider(prompt);
    this.lastRedactionApplied = redaction.redactionApplied;
    this.lastRedactedValueCount = redaction.redactedValueCount;
    this.lastRedactionCategories = redaction.redactionCategories;

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: redaction.redactedPrompt.system,
        messages: [{ role: 'user', content: redaction.redactedPrompt.user }],
      });
    } catch (cause) {
      throw this.toControlledError(cause);
    }

    this.verified = true;

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    if (!text) {
      throw new ApiError(
        502,
        'AI_PROVIDER_ERROR',
        'The Anthropic API response did not contain any text content.',
      );
    }

    return text;
  }

  /**
   * Translates an error thrown by the Anthropic SDK into a controlled
   * {@link ApiError}, preserving the distinction between authentication,
   * rate-limit, network, and other provider failures -- callers (and the
   * frontend) can tell these apart by `code`, rather than every failure
   * collapsing into one generic message. Never includes the API key or raw
   * request/response headers in the thrown error.
   */
  private toControlledError(cause: unknown): ApiError {
    if (cause instanceof AuthenticationError || cause instanceof PermissionDeniedError) {
      return new ApiError(
        401,
        'AI_PROVIDER_AUTH_FAILED',
        'Anthropic rejected the configured API key (authentication failed). Check that ' +
          'ANTHROPIC_API_KEY is correct and active.',
        toSafeErrorDetails(cause),
      );
    }

    if (cause instanceof RateLimitError) {
      return new ApiError(
        429,
        'AI_PROVIDER_RATE_LIMITED',
        'The Anthropic API rate limit was exceeded. Try again shortly.',
        toSafeErrorDetails(cause),
      );
    }

    if (cause instanceof APIConnectionError) {
      return new ApiError(
        502,
        'AI_PROVIDER_NETWORK_ERROR',
        'Could not reach the Anthropic API (network error).',
        cause.message ? { message: cause.message } : undefined,
      );
    }

    if (cause instanceof APIError) {
      return new ApiError(
        502,
        'AI_PROVIDER_ERROR',
        'The request to the Anthropic API failed.',
        toSafeErrorDetails(cause),
      );
    }

    return new ApiError(
      502,
      'AI_PROVIDER_ERROR',
      'The request to the Anthropic API failed.',
      cause instanceof Error ? cause.message : undefined,
    );
  }
}
