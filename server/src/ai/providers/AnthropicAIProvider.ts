import Anthropic from '@anthropic-ai/sdk';
import type { Incident } from '../../../../shared/types/incident.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AICompletionContext, AIPrompt, AIProvider } from './AIProvider.js';

const MAX_OUTPUT_TOKENS = 4096;

/**
 * Real AI provider backed by the Anthropic Messages API. Used when
 * `AI_PROVIDER=anthropic`. The API key is read from `ANTHROPIC_API_KEY` on
 * the backend only -- it is never exposed to the frontend.
 *
 * The key is checked lazily, on the first call to {@link complete}, rather
 * than at construction/startup time: a missing key must produce a clear,
 * catchable configuration error for that one request, not crash the whole
 * application (which would also break the `mock` provider for everyone
 * else running the app locally without a key configured).
 */
export class AnthropicAIProvider implements AIProvider {
  readonly name = 'anthropic' as const;
  readonly model: string;

  private readonly client: Anthropic | null;

  constructor(apiKey: string | undefined, model: string) {
    this.model = model;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async complete(_incident: Incident, prompt: AIPrompt, _context?: AICompletionContext): Promise<string> {
    if (!this.client) {
      throw new ApiError(
        503,
        'AI_PROVIDER_NOT_CONFIGURED',
        'AI_PROVIDER is set to "anthropic" but ANTHROPIC_API_KEY is not configured. Set ' +
          'ANTHROPIC_API_KEY in your .env file, or set AI_PROVIDER=mock to use the offline mock ' +
          'provider for local development.',
      );
    }

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      });
    } catch (cause) {
      throw new ApiError(
        502,
        'AI_PROVIDER_ERROR',
        'The request to the Anthropic API failed.',
        cause instanceof Error ? cause.message : cause,
      );
    }

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
}
