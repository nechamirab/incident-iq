import { describe, expect, it } from 'vitest';
import {
  resolveProviderSelection,
  type ProviderSelectionConfig,
} from '../src/ai/providers/resolveProviderSelection.js';

function buildConfig(overrides: Partial<ProviderSelectionConfig> = {}): ProviderSelectionConfig {
  return {
    aiProvider: 'mock',
    anthropicApiKey: undefined,
    openaiApiKey: undefined,
    allowMockFallback: false,
    ...overrides,
  };
}

describe('resolveProviderSelection', () => {
  it('selects mock when AI_PROVIDER=mock, regardless of key/fallback settings', () => {
    const selection = resolveProviderSelection(
      buildConfig({ aiProvider: 'mock', anthropicApiKey: 'sk-ant-test', allowMockFallback: true }),
    );
    expect(selection).toEqual({ kind: 'mock' });
  });

  it('selects anthropic when AI_PROVIDER=anthropic and a key is configured', () => {
    const selection = resolveProviderSelection(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: 'sk-ant-test' }),
    );
    expect(selection).toEqual({ kind: 'anthropic' });
  });

  it('does not fall back to mock by default when the anthropic key is missing', () => {
    const selection = resolveProviderSelection(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: undefined, allowMockFallback: false }),
    );
    expect(selection).toEqual({ kind: 'anthropic-not-configured' });
  });

  it('falls back to mock only when ALLOW_MOCK_FALLBACK=true and the anthropic key is missing', () => {
    const selection = resolveProviderSelection(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: undefined, allowMockFallback: true }),
    );
    expect(selection.kind).toBe('mock-fallback');
    if (selection.kind === 'mock-fallback') {
      expect(selection.reason.length).toBeGreaterThan(0);
      expect(selection.reason).toMatch(/ANTHROPIC_API_KEY/);
    }
  });

  it('never falls back merely because fallback is allowed, if an anthropic key is actually configured', () => {
    const selection = resolveProviderSelection(
      buildConfig({ aiProvider: 'anthropic', anthropicApiKey: 'sk-ant-test', allowMockFallback: true }),
    );
    expect(selection).toEqual({ kind: 'anthropic' });
  });

  it('selects openai when AI_PROVIDER=openai and a key is configured', () => {
    const selection = resolveProviderSelection(
      buildConfig({ aiProvider: 'openai', openaiApiKey: 'sk-openai-test' }),
    );
    expect(selection).toEqual({ kind: 'openai' });
  });

  it('does not fall back to mock by default when the openai key is missing', () => {
    const selection = resolveProviderSelection(
      buildConfig({ aiProvider: 'openai', openaiApiKey: undefined, allowMockFallback: false }),
    );
    expect(selection).toEqual({ kind: 'openai-not-configured' });
  });

  it('falls back to mock only when ALLOW_MOCK_FALLBACK=true and the openai key is missing', () => {
    const selection = resolveProviderSelection(
      buildConfig({ aiProvider: 'openai', openaiApiKey: undefined, allowMockFallback: true }),
    );
    expect(selection.kind).toBe('mock-fallback');
    if (selection.kind === 'mock-fallback') {
      expect(selection.reason.length).toBeGreaterThan(0);
      expect(selection.reason).toMatch(/OPENAI_API_KEY/);
    }
  });

  it('never falls back merely because fallback is allowed, if an openai key is actually configured', () => {
    const selection = resolveProviderSelection(
      buildConfig({ aiProvider: 'openai', openaiApiKey: 'sk-openai-test', allowMockFallback: true }),
    );
    expect(selection).toEqual({ kind: 'openai' });
  });

  it('an anthropic key never satisfies an openai selection, and vice versa', () => {
    const selection = resolveProviderSelection(
      buildConfig({
        aiProvider: 'openai',
        anthropicApiKey: 'sk-ant-test',
        openaiApiKey: undefined,
        allowMockFallback: false,
      }),
    );
    expect(selection).toEqual({ kind: 'openai-not-configured' });
  });
});
