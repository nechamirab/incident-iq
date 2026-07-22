import type { AppConfig } from '../../config/env.js';

/** The subset of {@link AppConfig} provider selection actually depends on. */
export type ProviderSelectionConfig = Pick<
  AppConfig,
  'aiProvider' | 'anthropicApiKey' | 'openaiApiKey' | 'allowMockFallback'
>;

export type ProviderSelection =
  | { kind: 'mock' }
  | { kind: 'anthropic' }
  /** `AI_PROVIDER=anthropic`, no key, fallback not allowed -- the caller must still construct an `AnthropicAIProvider` so its existing lazy "not configured" error fires on first use, rather than crashing the whole process at startup. */
  | { kind: 'anthropic-not-configured' }
  | { kind: 'openai' }
  /** Same as `anthropic-not-configured`, for `AI_PROVIDER=openai`. */
  | { kind: 'openai-not-configured' }
  | { kind: 'mock-fallback'; reason: string };

/**
 * Decides which concrete `AIProvider` `createAIProvider` should build, and
 * whether that choice is a fallback. Pure and independent of any provider
 * SDK/`MockAIProvider`/`AnthropicAIProvider`/`OpenAIProvider` themselves, so
 * every selection scenario is directly unit-testable without constructing a
 * real client or mocking network calls.
 *
 * This is the *only* place the "which provider" decision is made --
 * `createAIProvider` is the single caller, and every AI-invoking service
 * (`analysisService`, `skepticReviewService`, `postmortemService`) receives
 * whichever provider it builds via dependency injection rather than ever
 * deciding this for themselves.
 *
 * @param config The provider-relevant subset of the resolved app config.
 * @returns Which provider to build, and why, if it's a fallback.
 */
export function resolveProviderSelection(config: ProviderSelectionConfig): ProviderSelection {
  if (config.aiProvider === 'mock') {
    return { kind: 'mock' };
  }

  if (config.aiProvider === 'anthropic') {
    if (config.anthropicApiKey) {
      return { kind: 'anthropic' };
    }
    if (config.allowMockFallback) {
      return {
        kind: 'mock-fallback',
        reason:
          'AI_PROVIDER is set to "anthropic" but ANTHROPIC_API_KEY is not configured; falling back ' +
          'to the mock provider because ALLOW_MOCK_FALLBACK=true.',
      };
    }
    return { kind: 'anthropic-not-configured' };
  }

  // config.aiProvider === 'openai'
  if (config.openaiApiKey) {
    return { kind: 'openai' };
  }
  if (config.allowMockFallback) {
    return {
      kind: 'mock-fallback',
      reason:
        'AI_PROVIDER is set to "openai" but OPENAI_API_KEY is not configured; falling back to the ' +
        'mock provider because ALLOW_MOCK_FALLBACK=true.',
    };
  }
  return { kind: 'openai-not-configured' };
}
