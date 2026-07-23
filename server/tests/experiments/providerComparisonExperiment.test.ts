import { describe, expect, it } from 'vitest';
import { runProviderComparisonExperiment } from '../../src/experiments/providerComparisonExperiment.js';
import { MockAIProvider } from '../../src/ai/providers/MockAIProvider.js';
import { sampleIncidents } from '../../src/data/incidents/index.js';
import type { AICompletionContext, AIPrompt, AIProvider } from '../../src/ai/providers/AIProvider.js';
import type { Incident } from '../../../shared/types/incident.js';

const incident = sampleIncidents.find((item) => item.id === 'sample-db-connection-leak')!;

/** A minimal `AIProvider` stand-in named "openai", used only to exercise the not-run path (its `complete` is never actually invoked in these tests, since the gate disallows the call before it would be reached). */
class NamedFakeProvider implements AIProvider {
  readonly name = 'openai' as const;
  readonly model = 'fake-openai-model';
  readonly configuredProvider = 'openai' as const;
  readonly fallbackUsed = false;
  readonly fallbackReason = null;
  readonly providerVerified = false;
  readonly providerRequestId = null;
  readonly redactionApplied = false;
  readonly redactedValueCount = 0;
  readonly redactionCategories: readonly string[] = [];

  complete(_incident: Incident, _prompt: AIPrompt, _context?: AICompletionContext): Promise<string> {
    return Promise.reject(
      new Error('NamedFakeProvider.complete should never be called when the gate disallows the call.'),
    );
  }
}

describe('runProviderComparisonExperiment (Experiment B)', () => {
  it('always runs the mock leg', async () => {
    const result = await runProviderComparisonExperiment({
      incident,
      mockProvider: new MockAIProvider(),
      realProviderAttempts: [],
    });

    expect(result.mockLeg.status).toBe('ran');
    expect(result.realLegs).toEqual([]);
    expect(result.comparisons).toEqual([]);
  });

  it('records a real provider attempt as not-run, with its gate reason, rather than inventing output', async () => {
    const result = await runProviderComparisonExperiment({
      incident,
      mockProvider: new MockAIProvider(),
      realProviderAttempts: [
        {
          provider: new NamedFakeProvider(),
          gate: { allowed: false, reason: 'No API key is configured for the requested provider.' },
        },
      ],
    });

    expect(result.realLegs).toHaveLength(1);
    expect(result.realLegs[0]).toEqual({
      status: 'not-run',
      provider: 'openai',
      reason: 'No API key is configured for the requested provider.',
    });
    expect(result.comparisons).toEqual([]);
  });
});
