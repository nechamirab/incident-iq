import { describe, expect, it } from 'vitest';
import { createAIProvider, getAiProviderDiagnostics, type CreateAIProviderConfig } from '../src/ai/providers/createAIProvider.js';
import { MockAIProvider } from '../src/ai/providers/MockAIProvider.js';
import { AnthropicAIProvider } from '../src/ai/providers/AnthropicAIProvider.js';
import { OpenAIProvider } from '../src/ai/providers/OpenAIProvider.js';

function buildConfig(overrides: Partial<CreateAIProviderConfig> = {}): CreateAIProviderConfig {
  return {
    aiProvider: 'mock',
    anthropicApiKey: undefined,
    anthropicModel: 'claude-sonnet-5',
    openaiApiKey: undefined,
    openaiModel: 'gpt-5.1',
    allowMockFallback: false,
    ...overrides,
  };
}

describe('createAIProvider', () => {
  it('returns a provider matching the AIProvider contract using the real, unconfigured environment', () => {
    const provider = createAIProvider();
    expect(['mock', 'anthropic', 'openai']).toContain(provider.name);
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

  it('mock mode does not require an Anthropic or OpenAI key', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'mock', anthropicApiKey: undefined, openaiApiKey: undefined }),
    );
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

  it('AI_PROVIDER=openai with a key selects OpenAIProvider', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'openai', openaiApiKey: 'sk-openai-test-key' }),
    );
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe('openai');
    expect(provider.configuredProvider).toBe('openai');
    expect(provider.fallbackUsed).toBe(false);
    expect(provider.fallbackReason).toBeNull();
  });

  it('openai mode uses the configured OPENAI_MODEL', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'openai', openaiApiKey: 'sk-openai-test-key', openaiModel: 'gpt-5.1-mini' }),
    );
    expect(provider.model).toBe('gpt-5.1-mini');
  });

  it('openai mode with a missing key (fallback disabled) returns a configuration error on use, not silent mock output', async () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'openai', openaiApiKey: undefined, allowMockFallback: false }),
    );
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe('openai');

    await expect(
      provider.complete({ evidence: [] } as never, { system: 'x', user: 'x' }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_PROVIDER_NOT_CONFIGURED' });
  });

  it('openai mode with an empty key (fallback disabled) also returns a configuration error on use', async () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'openai', openaiApiKey: '', allowMockFallback: false }),
    );
    expect(provider).toBeInstanceOf(OpenAIProvider);

    await expect(
      provider.complete({ evidence: [] } as never, { system: 'x', user: 'x' }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_PROVIDER_NOT_CONFIGURED' });
  });

  it('mock fallback is disabled by default for anthropic (ALLOW_MOCK_FALLBACK unset)', () => {
    const provider = createAIProvider(buildConfig({ aiProvider: 'anthropic', anthropicApiKey: undefined }));
    expect(provider.fallbackUsed).toBe(false);
    expect(provider).toBeInstanceOf(AnthropicAIProvider);
  });

  it('mock fallback is disabled by default for openai (ALLOW_MOCK_FALLBACK unset)', () => {
    const provider = createAIProvider(buildConfig({ aiProvider: 'openai', openaiApiKey: undefined }));
    expect(provider.fallbackUsed).toBe(false);
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('explicit fallback (ALLOW_MOCK_FALLBACK=true, no anthropic key) uses MockAIProvider', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: undefined, allowMockFallback: true }),
    );
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('explicit fallback records providerUsed as mock, with the configured provider and reason preserved (anthropic)', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: undefined, allowMockFallback: true }),
    );
    expect(provider.name).toBe('mock');
    expect(provider.configuredProvider).toBe('anthropic');
    expect(provider.fallbackUsed).toBe(true);
    expect(provider.fallbackReason).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('explicit fallback (ALLOW_MOCK_FALLBACK=true, no openai key) uses MockAIProvider', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'openai', openaiApiKey: undefined, allowMockFallback: true }),
    );
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('explicit fallback records providerUsed as mock, with the configured provider and reason preserved (openai)', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'openai', openaiApiKey: undefined, allowMockFallback: true }),
    );
    expect(provider.name).toBe('mock');
    expect(provider.configuredProvider).toBe('openai');
    expect(provider.fallbackUsed).toBe(true);
    expect(provider.fallbackReason).toMatch(/OPENAI_API_KEY/);
  });

  it('fallback never occurs when an anthropic key is actually configured, even with ALLOW_MOCK_FALLBACK=true', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: 'sk-ant-real', allowMockFallback: true }),
    );
    expect(provider).toBeInstanceOf(AnthropicAIProvider);
    expect(provider.fallbackUsed).toBe(false);
  });

  it('fallback never occurs when an openai key is actually configured, even with ALLOW_MOCK_FALLBACK=true', () => {
    const provider = createAIProvider(
      buildConfig({ aiProvider: 'openai', openaiApiKey: 'sk-openai-real', allowMockFallback: true }),
    );
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.fallbackUsed).toBe(false);
  });
});

describe('getAiProviderDiagnostics', () => {
  it('reports the model relevant to whichever provider is configured, not an unrelated one', () => {
    const config = buildConfig({
      aiProvider: 'openai',
      openaiApiKey: 'sk-openai-real',
      openaiModel: 'gpt-5.1-mini',
      anthropicModel: 'claude-sonnet-5',
    });
    const provider = createAIProvider(config);
    const diagnostics = getAiProviderDiagnostics(config, provider);
    expect(diagnostics.configuredModel).toBe('gpt-5.1-mini');
    expect(diagnostics.configuredProvider).toBe('openai');
  });

  it('reports apiKeyConfigured based only on the currently configured provider\'s own key', () => {
    const config = buildConfig({
      aiProvider: 'openai',
      openaiApiKey: undefined,
      anthropicApiKey: 'sk-ant-leftover-in-env',
    });
    const provider = createAIProvider(config);
    const diagnostics = getAiProviderDiagnostics(config, provider);
    expect(diagnostics.apiKeyConfigured).toBe(false);
  });

  it('reports configuredModel as null for mock, which has no configurable model', () => {
    const config = buildConfig({ aiProvider: 'mock' });
    const provider = createAIProvider(config);
    const diagnostics = getAiProviderDiagnostics(config, provider);
    expect(diagnostics.configuredModel).toBeNull();
  });
});
