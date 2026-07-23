import { describe, expect, it } from 'vitest';
import { runPromptSensitivityExperiment } from '../../src/experiments/promptSensitivityExperiment.js';
import { MockAIProvider } from '../../src/ai/providers/MockAIProvider.js';
import { sampleIncidents } from '../../src/data/incidents/index.js';

const incident = sampleIncidents.find((item) => item.id === 'sample-db-connection-leak')!;

describe('runPromptSensitivityExperiment (Experiment C)', () => {
  it('always runs the mock pipeline check for both the standard and variant prompts', async () => {
    const result = await runPromptSensitivityExperiment({ incident, mockProvider: new MockAIProvider() });

    expect(result.mockPipelineCheck.standard.run.hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(result.mockPipelineCheck.variant.run.hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(result.mockPipelineCheck.note).toMatch(/ignores prompt text/);
  });

  it('records the real comparison as NOT RUN when no real provider is supplied', async () => {
    const result = await runPromptSensitivityExperiment({ incident, mockProvider: new MockAIProvider() });
    expect(result.realComparison.status).toBe('not-run');
  });
});
