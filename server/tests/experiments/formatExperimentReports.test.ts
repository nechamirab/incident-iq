import { describe, expect, it } from 'vitest';
import {
  formatPromptComparisonMarkdown,
  formatProviderComparisonMarkdown,
  formatSkepticReviewMarkdown,
} from '../../src/experiments/formatExperimentReports.js';
import { runPromptComparisonExperiment } from '../../src/experiments/promptComparisonExperiment.js';
import { runProviderComparisonExperiment } from '../../src/experiments/providerComparisonExperiment.js';
import { runSkepticReviewEvaluationExperiment } from '../../src/experiments/skepticReviewEvaluationExperiment.js';
import { MockAIProvider } from '../../src/ai/providers/MockAIProvider.js';
import { sampleIncidents } from '../../src/data/incidents/index.js';

const incident = sampleIncidents.find((item) => item.id === 'sample-db-connection-leak')!;

describe('formatExperimentReports', () => {
  it('formats a not-run prompt-comparison result without throwing, and marks it NOT RUN', async () => {
    const result = await runPromptComparisonExperiment({ incident, mockProvider: new MockAIProvider() });
    const markdown = formatPromptComparisonMarkdown(result);
    expect(markdown).toContain('# Experiment A');
    expect(markdown).toContain('NOT RUN');
  });

  it('formats a provider-comparison result with no real legs attempted', async () => {
    const result = await runProviderComparisonExperiment({
      incident,
      mockProvider: new MockAIProvider(),
      realProviderAttempts: [],
    });
    const markdown = formatProviderComparisonMarkdown(result);
    expect(markdown).toContain('# Experiment B');
    expect(markdown).toContain('No real providers were attempted');
  });

  it('formats a skeptic-review result with a full criteria table', async () => {
    const mockProvider = new MockAIProvider();
    const result = await runSkepticReviewEvaluationExperiment({
      incident,
      mockProvider,
      reviewProvider: mockProvider,
      reviewGate: { allowed: true },
    });
    const markdown = formatSkepticReviewMarkdown(result);
    expect(markdown).toContain('# Experiment D');
    expect(markdown).toContain('Score:');
    expect(markdown).toMatch(/\| .+ \| (YES|NO) \| .+ \|/);
  });
});
