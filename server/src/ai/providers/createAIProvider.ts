import type { AiProviderDiagnostics } from '../../../../shared/types/health.js';
import { config as defaultConfig, type AppConfig } from '../../config/env.js';
import { AnthropicAIProvider } from './AnthropicAIProvider.js';
import type { AIProvider } from './AIProvider.js';
import { MockAIProvider } from './MockAIProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { resolveProviderSelection } from './resolveProviderSelection.js';

/** The subset of {@link AppConfig} needed to build a concrete provider instance. */
export type CreateAIProviderConfig = Pick<
  AppConfig,
  | 'aiProvider'
  | 'anthropicApiKey'
  | 'anthropicModel'
  | 'openaiApiKey'
  | 'openaiModel'
  | 'allowMockFallback'
>;

/**
 * Selects and constructs the single AI provider instance the whole
 * application uses, per {@link resolveProviderSelection}'s decision. This
 * is the *only* place in the codebase that chooses a concrete provider --
 * `createApp` calls it once and injects the result into every route, so
 * every AI-invoking service depends solely on the {@link AIProvider}
 * interface and never instantiates `MockAIProvider`/`AnthropicAIProvider`/
 * `OpenAIProvider` itself.
 *
 * Accepts an optional config override (defaulting to the real resolved
 * `config`) purely so tests can exercise every selection scenario without
 * mutating `process.env` or reloading modules.
 *
 * @param config The provider-relevant configuration to select from.
 * @returns The provider to use for every AI request this process makes.
 */
export function createAIProvider(config: CreateAIProviderConfig = defaultConfig): AIProvider {
  const selection = resolveProviderSelection(config);

  switch (selection.kind) {
    case 'mock':
      return new MockAIProvider();

    case 'anthropic':
    case 'anthropic-not-configured':
      // Both cases construct the same real provider: with a key, it works
      // normally; without one (and fallback not allowed), it already
      // raises a clear, catchable configuration error on first use rather
      // than crashing the whole process at startup -- see
      // AnthropicAIProvider's own doc comment for why that's deliberate.
      return new AnthropicAIProvider(config.anthropicApiKey, config.anthropicModel);

    case 'openai':
    case 'openai-not-configured':
      // Same reasoning as the anthropic/anthropic-not-configured pair above.
      return new OpenAIProvider(config.openaiApiKey, config.openaiModel);

    case 'mock-fallback':
      return new MockAIProvider({ configuredProvider: config.aiProvider, reason: selection.reason });

    default: {
      const exhaustiveCheck: never = selection;
      throw new Error(`Unhandled provider selection: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

/**
 * The model configured for whichever provider `AI_PROVIDER` actually
 * selects -- `null` for `mock`, which has no configurable model (its
 * `model` identifier is a fixed constant on `MockAIProvider` itself).
 */
function resolveConfiguredModel(
  config: Pick<AppConfig, 'aiProvider' | 'anthropicModel' | 'openaiModel'>,
): string | null {
  switch (config.aiProvider) {
    case 'anthropic':
      return config.anthropicModel;
    case 'openai':
      return config.openaiModel;
    case 'mock':
      return null;
    default: {
      const exhaustiveCheck: never = config.aiProvider;
      throw new Error(`Unhandled AI provider: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

/** Whether the API key relevant to the *currently configured* provider is present -- irrelevant keys for other providers (e.g. a leftover `ANTHROPIC_API_KEY` while `AI_PROVIDER=openai`) are never reported here. */
function resolveApiKeyConfigured(
  config: Pick<AppConfig, 'aiProvider' | 'anthropicApiKey' | 'openaiApiKey'>,
): boolean {
  switch (config.aiProvider) {
    case 'anthropic':
      return Boolean(config.anthropicApiKey);
    case 'openai':
      return Boolean(config.openaiApiKey);
    case 'mock':
      return false;
    default: {
      const exhaustiveCheck: never = config.aiProvider;
      throw new Error(`Unhandled AI provider: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

/**
 * Builds the safe (never secret-carrying) AI provider diagnostics reported
 * by `GET /api/health` -- never makes a provider request; `providerVerified`
 * simply reads whatever the injected provider instance already knows from
 * requests made elsewhere in the app's normal operation.
 *
 * @param config The provider-relevant configuration currently in effect.
 * @param provider The provider instance actually in use (from `createAIProvider`).
 */
export function getAiProviderDiagnostics(
  config: Pick<AppConfig, 'aiProvider' | 'anthropicApiKey' | 'anthropicModel' | 'openaiApiKey' | 'openaiModel' | 'allowMockFallback'>,
  provider: AIProvider,
): AiProviderDiagnostics {
  return {
    configuredProvider: config.aiProvider,
    apiKeyConfigured: resolveApiKeyConfigured(config),
    configuredModel: resolveConfiguredModel(config),
    mockFallbackEnabled: config.allowMockFallback,
    providerVerified: provider.providerVerified,
  };
}
