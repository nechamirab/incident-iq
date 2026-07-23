import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AuthenticationError,
  RateLimitError,
  APIConnectionError,
  PermissionDeniedError,
  BadRequestError,
} from '@anthropic-ai/sdk';
import { AnthropicAIProvider } from '../src/ai/providers/AnthropicAIProvider.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { buildIncidentAnalysisPrompt } from '../src/ai/prompts/incidentAnalysisV1.js';

// Mocks only the SDK's client (`messages.create`); every error class
// (`AuthenticationError`, `RateLimitError`, ...) is re-exported from the
// real module so `instanceof` checks in AnthropicAIProvider work exactly
// as they would against a real SDK response -- no real network call is
// ever made by this test file. `vi.mock` is hoisted above these imports
// by Vitest, so `mockCreate`/`constructorCalls` must be declared via
// `vi.hoisted` to be visible inside the (also hoisted) factory below.
const { mockCreate, constructorCalls } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  constructorCalls: [] as unknown[],
}));

vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  class FakeAnthropicClient {
    messages = { create: mockCreate };
    constructor(opts: unknown) {
      constructorCalls.push(opts);
    }
  }
  return { ...actual, default: FakeAnthropicClient };
});

const FAKE_SECRET_KEY = 'sk-ant-super-secret-test-key-do-not-leak';

function buildAuthError(): AuthenticationError {
  return new AuthenticationError(
    401,
    { type: 'authentication_error', message: 'invalid x-api-key' },
    'invalid x-api-key',
    new Headers(),
  );
}

function buildRateLimitError(): RateLimitError {
  return new RateLimitError(
    429,
    { type: 'rate_limit_error', message: 'rate limit exceeded' },
    'rate limit exceeded',
    new Headers(),
  );
}

function buildPermissionError(): PermissionDeniedError {
  return new PermissionDeniedError(
    403,
    { type: 'permission_error', message: 'permission denied' },
    'permission denied',
    new Headers(),
  );
}

function buildBadRequestError(): BadRequestError {
  return new BadRequestError(
    400,
    { type: 'invalid_request_error', message: 'bad request' },
    'bad request',
    new Headers(),
  );
}

describe('AnthropicAIProvider', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    constructorCalls.length = 0;
  });

  const incident = sampleIncidents[0];
  const prompt = buildIncidentAnalysisPrompt(incident);

  it('identifies itself as the anthropic provider with the configured model', () => {
    const provider = new AnthropicAIProvider(undefined, 'claude-sonnet-5');
    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBe('claude-sonnet-5');
    expect(provider.configuredProvider).toBe('anthropic');
    expect(provider.fallbackUsed).toBe(false);
    expect(provider.fallbackReason).toBeNull();
  });

  it('throws a clear, controlled error when no API key is configured, without making a network call', async () => {
    const provider = new AnthropicAIProvider(undefined, 'claude-sonnet-5');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_PROVIDER_NOT_CONFIGURED',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('the missing-key error message explains how to switch to the mock provider', async () => {
    const provider = new AnthropicAIProvider(undefined, 'claude-sonnet-5');
    await expect(provider.complete(incident, prompt)).rejects.toThrow(/AI_PROVIDER=mock/);
  });

  it('is not "verified" before any request has succeeded', () => {
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');
    expect(provider.providerVerified).toBe(false);
  });

  it('passes the configured API key and an explicit maxRetries to the SDK client', () => {
    new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');
    expect(constructorCalls).toEqual([{ apiKey: FAKE_SECRET_KEY, maxRetries: 2 }]);
  });

  it('becomes providerVerified after a successful completion', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '{"ok":true}' }] });
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');

    expect(provider.providerVerified).toBe(false);
    await provider.complete(incident, prompt);
    expect(provider.providerVerified).toBe(true);
  });

  it('returns the joined text content of a successful response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ],
    });
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');
    const result = await provider.complete(incident, prompt);
    expect(result).toBe('first\nsecond');
  });

  it('maps an authentication failure to a controlled 401 AI_PROVIDER_AUTH_FAILED error', async () => {
    mockCreate.mockRejectedValueOnce(buildAuthError());
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AI_PROVIDER_AUTH_FAILED',
    });
    expect(provider.providerVerified).toBe(false);
  });

  it('maps a permission-denied failure to the same controlled authentication error code', async () => {
    mockCreate.mockRejectedValueOnce(buildPermissionError());
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AI_PROVIDER_AUTH_FAILED',
    });
  });

  it('an authentication failure does not silently become a mock result', async () => {
    mockCreate.mockRejectedValueOnce(buildAuthError());
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({ code: 'AI_PROVIDER_AUTH_FAILED' });
    // The provider identifies itself as anthropic even after a failed call --
    // it never silently relabels itself as mock.
    expect(provider.name).toBe('anthropic');
  });

  it('maps a rate-limit failure to a controlled 429 AI_PROVIDER_RATE_LIMITED error', async () => {
    mockCreate.mockRejectedValueOnce(buildRateLimitError());
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 429,
      code: 'AI_PROVIDER_RATE_LIMITED',
    });
  });

  it('maps a network/connection failure to a controlled 502 AI_PROVIDER_NETWORK_ERROR error', async () => {
    mockCreate.mockRejectedValueOnce(new APIConnectionError({ message: 'ECONNREFUSED' }));
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_NETWORK_ERROR',
    });
  });

  it('maps any other API error to a controlled generic AI_PROVIDER_ERROR', async () => {
    mockCreate.mockRejectedValueOnce(buildBadRequestError());
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
    });
  });

  it('malformed (empty) response content is a distinct error from an authentication failure', async () => {
    mockCreate.mockResolvedValueOnce({ content: [] });
    const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
    });
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
      const provider = new AnthropicAIProvider(FAKE_SECRET_KEY, 'claude-sonnet-5');

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
