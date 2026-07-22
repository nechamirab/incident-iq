import { describe, expect, it } from 'vitest';
import { createAIProvider, type CreateAIProviderConfig } from '../src/ai/providers/createAIProvider.js';
import { MockAIProvider } from '../src/ai/providers/MockAIProvider.js';
import { AnthropicAIProvider } from '../src/ai/providers/AnthropicAIProvider.js';

function buildConfig(overrides: Partial<CreateAIProviderConfig> = {}): CreateAIProviderConfig {
  return {
    aiProvider: 'mock',
    anthropicApiKey: undefined,
    anthropicModel: 'claude-sonnet-5',
    allowMockFallback: false,
    ...overrides,
  };
}

describe('createAIProvider', () => {
  it('returns a provider matching the AIProvider contract using the real, unconfigured environment', () => {
    const provider = createAIProvider();
    expect(['mock', 'anthropic']).toContain(provider.name);
    expect(typeof provider.model).toBe('string');
    expect(typeof provider.complete).toBe('function');
  });

  it('AI_PROVIDER=mock selects MockAIProvider', () => {
    const provider = createAIProvider(buildConfig({ aiProvider: 'mock' }));
    expect(provider).toBeInstanceOf(MockAIProvider);
    expect(provider.name).toBe('mock');
    expect(provider.configuredProvider).toBe('mock');
    expect(provider.fallbackUsed).toBe(false);
  });

  it('mock mode does not require an Anthropic key', () => {
    const provider = createAIProvider(buildConfig({ aiProvider: 'mock', anthropicApiKey: undefined }));
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('AI_PROVIDER=anthropic with a key selects AnthropicAIProvider', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: 'sk-ant-test-key' }),
    );
    expect(provider).toBeInstanceOf(AnthropicAIProvider);
    expect(provider.name).toBe('anthropic');
    expect(provider.configuredProvider).toBe('anthropic');
    expect(provider.fallbackUsed).toBe(false);
    expect(provider.fallbackReason).toBeNull();
  });

  it('anthropic mode with a missing key (fallback disabled) returns a configuration error on use, not silent mock output', async () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: undefined, allowMockFallback: false }),
    );
    // Still an AnthropicAIProvider -- selecting the provider never silently
    // substitutes mock; the configuration error surfaces on first use.
    expect(provider).toBeInstanceOf(AnthropicAIProvider);
    expect(provider.name).toBe('anthropic');

    await expect(
      provider.complete({ evidence: [] } as never, { system: 'x', user: 'x' }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_PROVIDER_NOT_CONFIGURED' });
  });

  it('anthropic mode with an empty key (fallback disabled) also returns a configuration error on use', async () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: '', allowMockFallback: false }),
    );
    expect(provider).toBeInstanceOf(AnthropicAIProvider);

    await expect(
      provider.complete({ evidence: [] } as never, { system: 'x', user: 'x' }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_PROVIDER_NOT_CONFIGURED' });
  });

  it('mock fallback is disabled by default (ALLOW_MOCK_FALLBACK unset)', () => {
    const provider = createAIProvider(buildConfig({ aiProvider: 'anthropic', anthropicApiKey: undefined }));
    expect(provider.fallbackUsed).toBe(false);
    expect(provider).toBeInstanceOf(AnthropicAIProvider);
  });

  it('explicit fallback (ALLOW_MOCK_FALLBACK=true, no key) uses MockAIProvider', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: undefined, allowMockFallback: true }),
    );
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('explicit fallback records providerUsed as mock, with the configured provider and reason preserved', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: undefined, allowMockFallback: true }),
    );
    expect(provider.name).toBe('mock');
    expect(provider.configuredProvider).toBe('anthropic');
    expect(provider.fallbackUsed).toBe(true);
    expect(provider.fallbackReason).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('fallback never occurs when a key is actually configured, even with ALLOW_MOCK_FALLBACK=true', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: 'sk-ant-real', allowMockFallback: true }),
    );
    expect(provider).toBeInstanceOf(AnthropicAIProvider);
    expect(provider.fallbackUsed).toBe(false);
  });
});
