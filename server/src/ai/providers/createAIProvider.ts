import type { AiProviderDiagnostics } from '../../../../shared/types/health.js';
import { config as defaultConfig, type AppConfig } from '../../config/env.js';
import { AnthropicAIProvider } from './AnthropicAIProvider.js';
import type { AIProvider } from './AIProvider.js';
import { MockAIProvider } from './MockAIProvider.js';
import { resolveProviderSelection } from './resolveProviderSelection.js';

/** The subset of {@link AppConfig} needed to build a concrete provider instance. */
export type CreateAIProviderConfig = Pick<
  AppConfig,
  'aiProvider' | 'anthropicApiKey' | 'anthropicModel' | 'allowMockFallback'
>;

/**
 * Selects and constructs the single AI provider instance the whole
 * application uses, per {@link resolveProviderSelection}'s decision. This
 * is the *only* place in the codebase that chooses a concrete provider --
 * `createApp` calls it once and injects the result into every route, so
 * every AI-invoking service depends solely on the {@link AIProvider}
 * interface and never instantiates `MockAIProvider`/`AnthropicAIProvider`
 * itself.
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

    case 'mock-fallback':
      return new MockAIProvider({ configuredProvider: 'anthropic', reason: selection.reason });

    default: {
      const exhaustiveCheck: never = selection;
      throw new Error(`Unhandled provider selection: ${JSON.stringify(exhaustiveCheck)}`);
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
  config: Pick<AppConfig, 'aiProvider' | 'anthropicApiKey' | 'allowMockFallback'>,
  provider: AIProvider,
): AiProviderDiagnostics {
  return {
    configuredProvider: config.aiProvider,
    apiKeyConfigured: Boolean(config.anthropicApiKey),
    mockFallbackEnabled: config.allowMockFallback,
    providerVerified: provider.providerVerified,
  };
}
