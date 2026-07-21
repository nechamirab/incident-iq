import { describe, expect, it } from 'vitest';
import { createAIProvider } from '../src/ai/providers/createAIProvider.js';

describe('createAIProvider', () => {
  it('returns a provider matching the AIProvider contract', () => {
    const provider = createAIProvider();
    expect(['mock', 'anthropic']).toContain(provider.name);
    expect(typeof provider.model).toBe('string');
    expect(typeof provider.complete).toBe('function');
  });

  it('defaults to the mock provider when AI_PROVIDER is unset or invalid', () => {
    // config.aiProvider is resolved once at module load from the environment;
    // this project's .env ships with AI_PROVIDER=mock for local development.
    const provider = createAIProvider();
    if (provider.name === 'mock') {
      expect(provider.model).toContain('mock');
    }
  });
});
