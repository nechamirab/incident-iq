import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';
import type { AiProviderName } from '../../../../shared/types/analysisRun.js';
import type { Incident } from '../../../../shared/types/incident.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AICompletionContext, AIPrompt, AIProvider } from './AIProvider.js';

const MAX_OUTPUT_TOKENS = 4096;

/**
 * How long a single Responses API request is allowed to take before the SDK
 * aborts it as timed out. Deliberately explicit rather than relying on the
 * SDK's much longer default (10 minutes) -- a single incident-analysis
 * request has no legitimate reason to run that long, and a bounded timeout
 * means a hung request fails as a controlled, retriable error instead of
 * leaving a request in flight indefinitely.
 */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * How many times the OpenAI SDK retries a request on its own (network
 * errors, `429`, `5xx`) before giving up and letting `complete()` throw.
 * Mirrors {@link AnthropicAIProvider}'s `MAX_TRANSPORT_RETRIES` -- the same
 * transport-level retry policy applied consistently across real providers,
 * distinct from `runProviderWithRetry`'s one-shot repair retry for
 * malformed *output*, which is a completely separate concern layered on
 * top of this.
 */
const MAX_TRANSPORT_RETRIES = 2;

/** OpenAI's own error code for a billing/quota problem, distinct from ordinary rate limiting; both surface as HTTP 429. */
const QUOTA_ERROR_CODE = 'insufficient_quota';

interface OpenAiApiErrorLike {
  status?: number;
  message: string;
  code?: string | null;
  requestID?: string | null;
}

/** Only ever non-secret fields from an OpenAI SDK error -- never its `headers` (which can carry the request's Authorization header) or any other raw request/response data. `requestID` is derived from the safe `x-request-id` response header. */
function toSafeErrorDetails(error: OpenAiApiErrorLike): {
  status: number | undefined;
  message: string;
  requestId: string | null;
} {
  return { status: error.status, message: error.message, requestId: error.requestID ?? null };
}

function isMessageOutputItem(item: OpenAI.Responses.ResponseOutputItem): item is OpenAI.Responses.ResponseOutputMessage {
  return item.type === 'message';
}

function isRefusalContentPart(
  part: OpenAI.Responses.ResponseOutputText | OpenAI.Responses.ResponseOutputRefusal,
): part is OpenAI.Responses.ResponseOutputRefusal {
  return part.type === 'refusal';
}

/** Finds the model's stated refusal reason, if this response is a refusal rather than a normal completion. */
function findRefusalText(response: OpenAI.Responses.Response): string | null {
  for (const item of response.output) {
    if (!isMessageOutputItem(item)) {
      continue;
    }
    const refusal = item.content.find(isRefusalContentPart);
    if (refusal) {
      return refusal.refusal;
    }
  }
  return null;
}

/**
 * Real AI provider backed by the OpenAI Responses API. Used when
 * `AI_PROVIDER=openai` (directly, or when this exact class is what
 * `createAIProvider` builds because a key is configured). The API key is
 * read from `OPENAI_API_KEY` on the backend only -- it is never exposed to
 * the frontend, logged, or included in any thrown error's message or
 * details.
 *
 * The key is checked lazily, on the first call to {@link complete}, rather
 * than at construction/startup time -- mirroring {@link AnthropicAIProvider}
 * exactly, for the same reason: a missing key must produce a clear,
 * catchable configuration error for that one request, not crash the whole
 * server process (which would also take down `/api/health`).
 *
 * ### Why this does not use OpenAI Structured Outputs
 *
 * The `openai` SDK (v6.48.0, the version installed for this feature) can
 * generate a strict JSON Schema from a Zod schema via `zodTextFormat` and
 * have the Responses API constrain its own output to match it. This was
 * evaluated for use with this codebase's existing AI-facing Zod schemas
 * (`aiAnalysisResponse.schema.ts`, `skepticReviewResponse.schema.ts`,
 * `postmortemResponse.schema.ts`) and found to be **directly incompatible**
 * with them, for reasons specific to those schemas rather than to
 * Structured Outputs in general:
 *
 * 1. `AiHypothesisSchema.status` is `z.literal('proposed').optional()`.
 *    OpenAI's strict-mode JSON Schema requires *every* property to be
 *    listed in `required` (optionality can only be expressed by unioning
 *    with `null`, not by omission) -- the installed SDK's own
 *    `zodTextFormat`/`toStrictJsonSchema` helper throws synchronously
 *    (`Zod field ... uses .optional() without .nullable() which is not
 *    supported by the API`) the moment it is asked to convert this schema,
 *    confirmed by direct inspection of
 *    `node_modules/openai/lib/transform.js` rather than assumed from
 *    documentation.
 * 2. `AiAnalysisResponseSchema` has a top-level `.refine()` enforcing that
 *    every hypothesis `tempId` is unique -- an arbitrary cross-field
 *    invariant with no JSON Schema representation at all, strict or
 *    otherwise.
 *
 * A hand-written *adapter* schema could dodge both issues (drop the unused
 * `status` field entirely -- `mapAiResponseToAnalysisRun` already ignores
 * it and force-sets `status: 'proposed'` itself -- and drop the uniqueness
 * refinement, since it's a soft hint schema, not the final check either
 * way). But every one of this app's three AI-facing schemas already
 * describes its required JSON shape to the model in natural language
 * inside its versioned prompt (`RESPONSE_SHAPE_DESCRIPTION` and
 * equivalents), the same technique already relied on for both
 * `MockAIProvider` and `AnthropicAIProvider`; and the *only* validation
 * that actually matters for correctness -- the full domain Zod schema,
 * including the tempId-uniqueness `.refine()` -- runs identically for
 * every provider via `runProviderWithRetry` regardless of whether the
 * initial response came pre-constrained or not. A parallel, hand-maintained
 * adapter schema per response type would therefore buy, at best, a
 * marginally lower chance of needing the existing one-shot repair retry --
 * while adding a second schema per AI flow that must be kept in sync with
 * the real one by hand, and a new provider-specific coupling to the exact
 * installed versions of `zod`/`openai` that could silently break in a way
 * that leaves every *other* provider unaffected. That trade was judged not
 * worth it here, so `OpenAIProvider` mirrors `AnthropicAIProvider`'s
 * contract exactly: send the same versioned system/user prompt as plain
 * text, return the model's raw text response, and let the existing
 * validate-then-one-shot-repair pipeline be the sole and unweakened
 * authority, uniformly across every provider.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const;
  readonly model: string;
  readonly configuredProvider: AiProviderName = 'openai';
  readonly fallbackUsed = false;
  readonly fallbackReason = null;

  private readonly client: OpenAI | null;
  private verified = false;
  private lastRequestId: string | null = null;

  constructor(apiKey: string | undefined, model: string) {
    this.model = model;
    this.client = apiKey
      ? new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_TRANSPORT_RETRIES })
      : null;
  }

  get providerVerified(): boolean {
    return this.verified;
  }

  get providerRequestId(): string | null {
    return this.lastRequestId;
  }

  async complete(_incident: Incident, prompt: AIPrompt, _context?: AICompletionContext): Promise<string> {
    if (!this.client) {
      throw new ApiError(
        503,
        'AI_PROVIDER_NOT_CONFIGURED',
        'AI_PROVIDER is set to "openai" but OPENAI_API_KEY is not configured. Either set ' +
          'OPENAI_API_KEY in your .env file, or set AI_PROVIDER=mock to use the offline mock ' +
          'provider for local development.',
      );
    }

    let response: OpenAI.Responses.Response;
    try {
      response = await this.client.responses.create({
        model: this.model,
        instructions: prompt.system,
        input: prompt.user,
        max_output_tokens: MAX_OUTPUT_TOKENS,
      });
    } catch (cause) {
      throw this.toControlledError(cause);
    }

    this.lastRequestId = response.id;

    if (response.status === 'incomplete') {
      const reason = response.incomplete_details?.reason ?? 'unknown reason';
      throw new ApiError(
        502,
        'AI_PROVIDER_ERROR',
        `The OpenAI response was incomplete (${reason}). Try again, or reduce the amount of ` +
          'evidence attached to this incident if this persists.',
        { requestId: response.id },
      );
    }

    const refusal = findRefusalText(response);
    if (refusal !== null) {
      throw new ApiError(
        502,
        'AI_PROVIDER_REFUSED',
        'The OpenAI model declined to generate a response for this request.',
        { requestId: response.id },
      );
    }

    const text = response.output_text;
    if (!text) {
      throw new ApiError(
        502,
        'AI_PROVIDER_ERROR',
        'The OpenAI API response did not contain any text content.',
        { requestId: response.id },
      );
    }

    this.verified = true;
    return text;
  }

  /**
   * Translates an error thrown by the OpenAI SDK into a controlled
   * {@link ApiError}, preserving the distinction between authentication,
   * permission, rate-limit, quota, network, and other provider failures --
   * callers (and the frontend) can tell these apart by `code`, rather than
   * every failure collapsing into one generic message. Never includes the
   * API key or raw request/response headers in the thrown error; includes
   * the provider's own safe request id when available.
   */
  private toControlledError(cause: unknown): ApiError {
    if (cause instanceof AuthenticationError) {
      return new ApiError(
        401,
        'AI_PROVIDER_AUTH_FAILED',
        'OpenAI rejected the configured API key (authentication failed). Check that OPENAI_API_KEY ' +
          'is correct and active.',
        toSafeErrorDetails(cause),
      );
    }

    if (cause instanceof PermissionDeniedError) {
      return new ApiError(
        401,
        'AI_PROVIDER_AUTH_FAILED',
        'OpenAI denied access with the configured API key (permission denied). Check that the key ' +
          'has access to the requested model.',
        toSafeErrorDetails(cause),
      );
    }

    if (cause instanceof RateLimitError) {
      if (cause.code === QUOTA_ERROR_CODE) {
        return new ApiError(
          429,
          'AI_PROVIDER_QUOTA_EXCEEDED',
          'The configured OpenAI account has exceeded its quota or billing limit.',
          toSafeErrorDetails(cause),
        );
      }
      return new ApiError(
        429,
        'AI_PROVIDER_RATE_LIMITED',
        'The OpenAI API rate limit was exceeded. Try again shortly.',
        toSafeErrorDetails(cause),
      );
    }

    if (cause instanceof APIConnectionTimeoutError) {
      return new ApiError(
        502,
        'AI_PROVIDER_NETWORK_ERROR',
        `The request to the OpenAI API timed out after ${REQUEST_TIMEOUT_MS}ms.`,
        toSafeErrorDetails(cause),
      );
    }

    if (cause instanceof APIConnectionError) {
      return new ApiError(
        502,
        'AI_PROVIDER_NETWORK_ERROR',
        'Could not reach the OpenAI API (network error).',
        toSafeErrorDetails(cause),
      );
    }

    if (cause instanceof BadRequestError) {
      return new ApiError(
        502,
        'AI_PROVIDER_ERROR',
        'OpenAI rejected the request as invalid. This usually indicates a bug in this application\'s ' +
          'prompt construction, not a user-fixable configuration issue.',
        toSafeErrorDetails(cause),
      );
    }

    if (cause instanceof InternalServerError) {
      return new ApiError(
        502,
        'AI_PROVIDER_ERROR',
        'The OpenAI API reported a temporary server error. Try again shortly.',
        toSafeErrorDetails(cause),
      );
    }

    if (cause instanceof APIError) {
      return new ApiError(
        502,
        'AI_PROVIDER_ERROR',
        'The request to the OpenAI API failed.',
        toSafeErrorDetails(cause),
      );
    }

    return new ApiError(
      502,
      'AI_PROVIDER_ERROR',
      'The request to the OpenAI API failed.',
      cause instanceof Error ? cause.message : undefined,
    );
  }
}
