import { describe, expect, it } from 'vitest';
import { AnthropicAIProvider } from '../src/ai/providers/AnthropicAIProvider.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { buildIncidentAnalysisPrompt } from '../src/ai/prompts/incidentAnalysisV1.js';

describe('AnthropicAIProvider', () => {
  it('identifies itself as the anthropic provider with the configured model', () => {
    const provider = new AnthropicAIProvider(undefined, 'claude-sonnet-5');
    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBe('claude-sonnet-5');
  });

  it('throws a clear, controlled error when no API key is configured, without making a network call', async () => {
    const provider = new AnthropicAIProvider(undefined, 'claude-sonnet-5');
    const incident = sampleIncidents[0];
    const prompt = buildIncidentAnalysisPrompt(incident);

    await expect(provider.complete(incident, prompt)).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_PROVIDER_NOT_CONFIGURED',
    });
  });

  it('the missing-key error message explains how to switch to the mock provider', async () => {
    const provider = new AnthropicAIProvider(undefined, 'claude-sonnet-5');
    const incident = sampleIncidents[0];
    const prompt = buildIncidentAnalysisPrompt(incident);

    await expect(provider.complete(incident, prompt)).rejects.toThrow(/AI_PROVIDER=mock/);
  });
});
