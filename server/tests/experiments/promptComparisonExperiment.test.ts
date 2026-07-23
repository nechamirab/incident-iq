import { describe, expect, it } from 'vitest';
import { runPromptComparisonExperiment } from '../../src/experiments/promptComparisonExperiment.js';
import { MockAIProvider } from '../../src/ai/providers/MockAIProvider.js';
import { sampleIncidents } from '../../src/data/incidents/index.js';

const incident = sampleIncidents.find((item) => item.id === 'sample-db-connection-leak')!;

describe('runPromptComparisonExperiment (Experiment A)', () => {
  it('always runs the mock pipeline check for both v1 and v2, producing valid schema-conformant runs', async () => {
    const result = await runPromptComparisonExperiment({ incident, mockProvider: new MockAIProvider() });

    expect(result.mockPipelineCheck.v1.run.hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(result.mockPipelineCheck.v2.run.hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(result.mockPipelineCheck.note).toMatch(/ignoring the prompt text/);
  });

  it('records the real comparison as NOT RUN with an honest reason when no real provider is supplied', async () => {
    const result = await runPromptComparisonExperiment({ incident, mockProvider: new MockAIProvider() });

    expect(result.realComparison.status).toBe('not-run');
    if (result.realComparison.status === 'not-run') {
      expect(result.realComparison.reason.length).toBeGreaterThan(0);
    }
  });

  it('never invents a "ran" real comparison when the gate disallows it', async () => {
    const result = await runPromptComparisonExperiment({
      incident,
      mockProvider: new MockAIProvider(),
      realProviderAttempt: {
        provider: new MockAIProvider(),
        gate: { allowed: false, reason: 'RUN_REAL_AI_EXPERIMENTS is not set to "true".' },
      },
    });

    expect(result.realComparison).toEqual({
      status: 'not-run',
      reason: 'RUN_REAL_AI_EXPERIMENTS is not set to "true".',
    });
  });
});
