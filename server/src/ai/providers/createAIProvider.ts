import { config } from '../../config/env.js';
import { AnthropicAIProvider } from './AnthropicAIProvider.js';
import type { AIProvider } from './AIProvider.js';
import { MockAIProvider } from './MockAIProvider.js';

/**
 * Selects the AI provider based on the `AI_PROVIDER` environment variable
 * (`mock` by default). This is the only place in the codebase that chooses
 * a concrete provider -- everything else depends on the {@link AIProvider}
 * interface, so switching providers never requires touching business logic
 * or the UI.
 */
export function createAIProvider(): AIProvider {
  if (config.aiProvider === 'anthropic') {
    return new AnthropicAIProvider(config.anthropicApiKey, config.anthropicModel);
  }
  return new MockAIProvider();
}
