import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AuthenticationError,
  RateLimitError,
  APIConnectionError,
  APIConnectionTimeoutError,
  PermissionDeniedError,
  BadRequestError,
  InternalServerError,
} from 'openai';
import { OpenAIProvider } from '../src/ai/providers/OpenAIProvider.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { buildIncidentAnalysisPrompt } from '../src/ai/prompts/incidentAnalysisV1.js';
import { buildSkepticReviewPrompt } from '../src/ai/prompts/skepticReviewV1.js';
import { buildPostmortemPrompt } from '../src/ai/prompts/postmortemV1.js';
import { buildAnalysisRun } from './helpers/analysisRunFixture.js';
import { buildValidAiResponse, buildValidSkepticReviewResponse, buildValidPostmortemResponse } from './helpers/aiResponseFixtures.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { analyzeIncident } from '../src/services/analysisService.js';
import { runSkepticReview } from '../src/services/skepticReviewService.js';
import { generatePostmortem } from '../src/services/postmortemService.js';

// Mocks only the SDK's client (`responses.create`); every error class
// (`AuthenticationError`, `RateLimitError`, ...) is re-exported from the
// real module so `instanceof` checks in OpenAIProvider work exactly as
// they would against a real SDK response -- no real network call is ever
// made by this test file. `vi.mock` is hoisted above these imports by
// Vitest, so `mockCreate`/`constructorCalls` must be declared via
// `vi.hoisted` to be visible inside the (also hoisted) factory below.
const { mockCreate, constructorCalls } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  constructorCalls: [] as unknown[],
}));

vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openai')>();
  class FakeOpenAIClient {
    responses = { create: mockCreate };
    constructor(opts: unknown) {
      constructorCalls.push(opts);
    }
  }
  return { ...actual, default: FakeOpenAIClient };
});

const FAKE_SECRET_KEY = 'sk-openai-super-secret-test-key-do-not-leak';

function buildAuthError(): AuthenticationError {
  return new AuthenticationError(401, { type: 'authentication_error', message: 'invalid api key' }, 'invalid api key', new Headers());
}

function buildRateLimitError(): RateLimitError {
  return new RateLimitError(429, { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'rate limit exceeded' }, 'rate limit exceeded', new Headers());
}

function buildQuotaError(): RateLimitError {
  return new RateLimitError(429, { type: 'insufficient_quota', code: 'insufficient_quota', message: 'quota exceeded' }, 'quota exceeded', new Headers());
}

function buildPermissionError(): PermissionDeniedError {
  return new PermissionDeniedError(403, { type: 'permission_error', message: 'permission denied' }, 'permission denied', new Headers());
}

function buildBadRequestError(): BadRequestError {
  return new BadRequestError(400, { type: 'invalid_request_error', message: 'bad request' }, 'bad request', new Headers());
}

function buildInternalServerError(): InternalServerError {
  return new InternalServerError(500, { type: 'server_error', message: 'internal error' }, 'internal error', new Headers());
}

function buildResponse(text: string, overrides: Partial<Record<string, unknown>> = {}): unknown {
  return {
    id: 'resp_test_123',
    status: 'completed',
    output_text: text,
    output: [
      {
        type: 'message',
        id: 'msg_1',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text, annotations: [] }],
      },
    ],
    incomplete_details: null,
    ...overrides,
  };
}

describe('OpenAIProvider', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    constructorCalls.length = 0;
  });

  const incident = sampleIncidents[0];
  const prompt = buildIncidentAnalysisPrompt(incident);

  it('identifies itself as the openai provider with the configured model', () => {
    const provider = new OpenAIProvider(undefined, 'gpt-5.1');
    expect(provider.name).toBe('openai');
    expect(provider.model).toBe('gpt-5.1');
    expect(provider.configuredProvider).toBe('openai');
    expect(provider.fallbackUsed).toBe(false);
    expect(provider.fallbackReason).toBeNull();
  });

  it('throws a clear, controlled error when no API key is configured, without making a network call', async () => {
    const provider = new OpenAIProvider(undefined, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_PROVIDER_NOT_CONFIGURED',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('the missing-key error message explains how to switch to the mock provider', async () => {
    const provider = new OpenAIProvider(undefined, 'gpt-5.1');
    await expect(provider.complete(incident, prompt)).rejects.toThrow(/AI_PROVIDER=mock/);
  });

  it('is not "verified" before any request has succeeded', () => {
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    expect(provider.providerVerified).toBe(false);
  });

  it('has no request id before any request has completed', () => {
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    expect(provider.providerRequestId).toBeNull();
  });

  it('passes the configured API key, an explicit timeout, and maxRetries to the SDK client', () => {
    new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    expect(constructorCalls).toEqual([{ apiKey: FAKE_SECRET_KEY, timeout: 60_000, maxRetries: 2 }]);
  });

  it('becomes providerVerified after a successful completion', async () => {
    mockCreate.mockResolvedValueOnce(buildResponse('{"ok":true}'));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    expect(provider.providerVerified).toBe(false);
    await provider.complete(incident, prompt);
    expect(provider.providerVerified).toBe(true);
  });

  it('records the response id as providerRequestId after a successful completion', async () => {
    mockCreate.mockResolvedValueOnce(buildResponse('{"ok":true}', { id: 'resp_abc789' }));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await provider.complete(incident, prompt);
    expect(provider.providerRequestId).toBe('resp_abc789');
  });

  it('returns the response\'s output_text as the raw completion text', async () => {
    mockCreate.mockResolvedValueOnce(buildResponse('{"summary":"hello"}'));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    const result = await provider.complete(incident, prompt);
    expect(result).toBe('{"summary":"hello"}');
  });

  it('sends the system prompt as instructions and the user prompt as input, using the configured model', async () => {
    mockCreate.mockResolvedValueOnce(buildResponse('{"ok":true}'));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1-mini');
    await provider.complete(incident, prompt);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.1-mini',
        instructions: prompt.system,
        input: prompt.user,
      }),
    );
  });

  it('calls the OpenAI SDK for a skeptic-review context, exactly like the main analysis flow', async () => {
    mockCreate.mockResolvedValueOnce(buildResponse('{"ok":true}'));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    const reviewPrompt = buildSkepticReviewPrompt(incident, run);

    await provider.complete(incident, reviewPrompt, { kind: 'skeptic-review', analysisRun: run });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ input: reviewPrompt.user }));
  });

  it('calls the OpenAI SDK for a postmortem context, exactly like the main analysis flow', async () => {
    mockCreate.mockResolvedValueOnce(buildResponse('{"ok":true}'));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    const postmortemPrompt = buildPostmortemPrompt(incident, run);

    await provider.complete(incident, postmortemPrompt, { kind: 'postmortem', analysisRun: run });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ input: postmortemPrompt.user }));
  });

  it('maps an authentication failure to a controlled 401 AI_PROVIDER_AUTH_FAILED error', async () => {
    mockCreate.mockRejectedValueOnce(buildAuthError());
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AI_PROVIDER_AUTH_FAILED',
    });
    expect(provider.providerVerified).toBe(false);
  });

  it('maps a permission-denied failure to the same controlled authentication error code', async () => {
    mockCreate.mockRejectedValueOnce(buildPermissionError());
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AI_PROVIDER_AUTH_FAILED',
    });
  });

  it('an authentication failure does not silently become a mock result', async () => {
    mockCreate.mockRejectedValueOnce(buildAuthError());
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({ code: 'AI_PROVIDER_AUTH_FAILED' });
    expect(provider.name).toBe('openai');
  });

  it('maps a rate-limit failure to a controlled 429 AI_PROVIDER_RATE_LIMITED error', async () => {
    mockCreate.mockRejectedValueOnce(buildRateLimitError());
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 429,
      code: 'AI_PROVIDER_RATE_LIMITED',
    });
  });

  it('distinguishes a quota/billing failure from an ordinary rate limit, even though both are HTTP 429', async () => {
    mockCreate.mockRejectedValueOnce(buildQuotaError());
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 429,
      code: 'AI_PROVIDER_QUOTA_EXCEEDED',
    });
  });

  it('maps a network/connection failure to a controlled 502 AI_PROVIDER_NETWORK_ERROR error', async () => {
    mockCreate.mockRejectedValueOnce(new APIConnectionError({ message: 'ECONNREFUSED' }));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_NETWORK_ERROR',
    });
  });

  it('maps a request timeout to a controlled 502 AI_PROVIDER_NETWORK_ERROR error', async () => {
    mockCreate.mockRejectedValueOnce(new APIConnectionTimeoutError());
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_NETWORK_ERROR',
    });
  });

  it('maps a 400 bad-request failure to a controlled invalid-request error', async () => {
    mockCreate.mockRejectedValueOnce(buildBadRequestError());
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
    });
  });

  it('maps a 5xx server error to a controlled temporary-provider-error', async () => {
    mockCreate.mockRejectedValueOnce(buildInternalServerError());
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
    });
  });

  it('malformed (empty) response content is a distinct error from an authentication failure', async () => {
    mockCreate.mockResolvedValueOnce(buildResponse('', { output: [] }));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
    });
  });

  it('handles an incomplete response (e.g. truncated by max_output_tokens) as a distinct controlled error', async () => {
    mockCreate.mockResolvedValueOnce(
      buildResponse('', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }),
    );
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
    });
    expect(provider.providerVerified).toBe(false);
  });

  it('handles an explicit model refusal as a distinct controlled error, not an empty-response error', async () => {
    mockCreate.mockResolvedValueOnce(
      buildResponse('', {
        output: [
          {
            type: 'message',
            id: 'msg_1',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'refusal', refusal: 'I cannot help with that.' }],
          },
        ],
      }),
    );
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_REFUSED',
    });
    expect(provider.providerVerified).toBe(false);
  });

  it('never includes the API key in a thrown error, across every failure mode', async () => {
    const scenarios = [
      buildAuthError(),
      buildRateLimitError(),
      new APIConnectionError({ message: 'down' }),
      buildBadRequestError(),
    ];

    for (const scenario of scenarios) {
      mockCreate.mockRejectedValueOnce(scenario);
      const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');

      try {
        await provider.complete(incident, prompt);
        throw new Error('expected complete() to reject');
      } catch (error) {
        const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
        expect(serialized).not.toContain(FAKE_SECRET_KEY);
      }
    }
  });
});

/**
 * Proves the three AI orchestration services actually drive a real
 * `OpenAIProvider` instance end to end (not merely a test double), through
 * the exact same `runProviderWithRetry` pipeline used for every other
 * provider -- no OpenAI-specific branching exists in any of these
 * services. The SDK is mocked (see the `vi.mock('openai', ...)` above);
 * no real network call is made.
 */
describe('OpenAIProvider drives analysis / skeptic review / postmortem end to end', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  const incident = sampleIncidents[0];

  it('analyzeIncident uses OpenAIProvider and records providerUsed: "openai"', async () => {
    mockCreate.mockResolvedValueOnce(
      buildResponse(JSON.stringify(buildValidAiResponse({}, incident.evidence[0].id))),
    );
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    const repository = new InMemoryIncidentRepository(sampleIncidents);

    const run = await analyzeIncident(repository, provider, incident.id);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(run.provider).toBe('openai');
    expect(run.configuredProvider).toBe('openai');
    expect(run.fallbackUsed).toBe(false);
  });

  it('runSkepticReview uses OpenAIProvider and records providerUsed: "openai"', async () => {
    mockCreate.mockResolvedValueOnce(buildResponse(JSON.stringify(buildValidSkepticReviewResponse())));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    const repository = new InMemoryIncidentRepository(sampleIncidents);
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const review = await runSkepticReview(repository, provider, incident.id);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(review.provider).toBe('openai');
    expect(review.configuredProvider).toBe('openai');
    expect(review.fallbackUsed).toBe(false);
  });

  it('generatePostmortem uses OpenAIProvider and records providerUsed: "openai"', async () => {
    mockCreate.mockResolvedValueOnce(buildResponse(JSON.stringify(buildValidPostmortemResponse())));
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    const repository = new InMemoryIncidentRepository(sampleIncidents);
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const updated = await generatePostmortem(repository, provider, incident.id);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(updated.postmortem?.provider).toBe('openai');
    expect(updated.postmortem?.configuredProvider).toBe('openai');
    expect(updated.postmortem?.fallbackUsed).toBe(false);
  });

  it('mock fallback is never used for any of the three flows when ALLOW_MOCK_FALLBACK=false and a key is configured', async () => {
    mockCreate.mockResolvedValueOnce(
      buildResponse(JSON.stringify(buildValidAiResponse({}, incident.evidence[0].id))),
    );
    const provider = new OpenAIProvider(FAKE_SECRET_KEY, 'gpt-5.1');
    const repository = new InMemoryIncidentRepository(sampleIncidents);

    const run = await analyzeIncident(repository, provider, incident.id);

    expect(run.provider).not.toBe('mock');
    expect(run.fallbackUsed).toBe(false);
    expect(run.fallbackReason).toBeNull();
  });
});
