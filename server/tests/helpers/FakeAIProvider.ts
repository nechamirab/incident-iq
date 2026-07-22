import type { Incident } from '../../../shared/types/incident.js';
import type { AICompletionContext, AIPrompt, AIProvider } from '../../src/ai/providers/AIProvider.js';

/**
 * Test double for {@link AIProvider}: returns a scripted sequence of raw
 * text responses (or throws a scripted error), one per call, so retry
 * logic can be exercised deterministically without a network call.
 */
export class FakeAIProvider implements AIProvider {
  readonly name = 'mock' as const;
  readonly model = 'fake-test-model';
  readonly configuredProvider = 'mock' as const;
  readonly fallbackUsed = false;
  readonly fallbackReason = null;
  readonly providerVerified = null;

  readonly promptsReceived: AIPrompt[] = [];
  readonly contextsReceived: (AICompletionContext | undefined)[] = [];
  callCount = 0;

  constructor(private readonly responses: ReadonlyArray<string | Error>) {}

  async complete(_incident: Incident, prompt: AIPrompt, context?: AICompletionContext): Promise<string> {
    this.promptsReceived.push(prompt);
    this.contextsReceived.push(context);
    const index = Math.min(this.callCount, this.responses.length - 1);
    this.callCount += 1;

    const response = this.responses[index];
    if (response instanceof Error) {
      throw response;
    }
    return response;
  }
}
