import { describe, expect, it } from 'vitest';
import { buildAppConfig } from '../src/config/env.js';

/** A minimal, valid base environment; each test overrides only what it's testing. */
function buildEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return { ...overrides };
}

describe('buildAppConfig', () => {
  it('defaults aiProvider to "mock" when AI_PROVIDER is unset', () => {
    const result = buildAppConfig(buildEnv());
    expect(result.aiProvider).toBe('mock');
  });

  it('accepts AI_PROVIDER=mock and does not require an API key', () => {
    const result = buildAppConfig(buildEnv({ AI_PROVIDER: 'mock' }));
    expect(result.aiProvider).toBe('mock');
    expect(result.anthropicApiKey).toBeUndefined();
  });

  it('accepts AI_PROVIDER=anthropic with a key configured', () => {
    const result = buildAppConfig(buildEnv({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test-key' }));
    expect(result.aiProvider).toBe('anthropic');
    expect(result.anthropicApiKey).toBe('sk-ant-test-key');
  });

  it('accepts AI_PROVIDER=openai with a key configured', () => {
    const result = buildAppConfig(buildEnv({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-openai-test-key' }));
    expect(result.aiProvider).toBe('openai');
    expect(result.openaiApiKey).toBe('sk-openai-test-key');
  });

  it('rejects an unsupported AI_PROVIDER value', () => {
    expect(() => buildAppConfig(buildEnv({ AI_PROVIDER: 'azure-openai' }))).toThrow(/AI_PROVIDER/);
  });

  it('treats a missing ANTHROPIC_API_KEY as "no key configured", not an error', () => {
    const result = buildAppConfig(buildEnv({ AI_PROVIDER: 'anthropic' }));
    expect(result.anthropicApiKey).toBeUndefined();
  });

  it('treats an empty ANTHROPIC_API_KEY as "no key configured", not an error', () => {
    const result = buildAppConfig(buildEnv({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' }));
    expect(result.anthropicApiKey).toBeUndefined();
  });

  it('treats a whitespace-only ANTHROPIC_API_KEY as "no key configured"', () => {
    const result = buildAppConfig(buildEnv({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '   ' }));
    expect(result.anthropicApiKey).toBeUndefined();
  });

  it('defaults anthropicModel when ANTHROPIC_MODEL is unset', () => {
    const result = buildAppConfig(buildEnv());
    expect(result.anthropicModel).toBe('claude-sonnet-5');
  });

  it('uses an explicit ANTHROPIC_MODEL when set', () => {
    const result = buildAppConfig(buildEnv({ ANTHROPIC_MODEL: 'claude-opus-4-8' }));
    expect(result.anthropicModel).toBe('claude-opus-4-8');
  });

  it('treats a missing OPENAI_API_KEY as "no key configured", not an error', () => {
    const result = buildAppConfig(buildEnv({ AI_PROVIDER: 'openai' }));
    expect(result.openaiApiKey).toBeUndefined();
  });

  it('treats an empty OPENAI_API_KEY as "no key configured", not an error', () => {
    const result = buildAppConfig(buildEnv({ AI_PROVIDER: 'openai', OPENAI_API_KEY: '' }));
    expect(result.openaiApiKey).toBeUndefined();
  });

  it('treats a whitespace-only OPENAI_API_KEY as "no key configured"', () => {
    const result = buildAppConfig(buildEnv({ AI_PROVIDER: 'openai', OPENAI_API_KEY: '   ' }));
    expect(result.openaiApiKey).toBeUndefined();
  });

  it('defaults openaiModel to a centralized, documented default when OPENAI_MODEL is unset', () => {
    const result = buildAppConfig(buildEnv());
    expect(result.openaiModel).toBe('gpt-5.1');
  });

  it('uses an explicit OPENAI_MODEL when set', () => {
    const result = buildAppConfig(buildEnv({ OPENAI_MODEL: 'gpt-5.1-mini' }));
    expect(result.openaiModel).toBe('gpt-5.1-mini');
  });

  it('keeps anthropic and openai configuration fully independent of each other', () => {
    const result = buildAppConfig(
      buildEnv({
        AI_PROVIDER: 'openai',
        ANTHROPIC_API_KEY: 'sk-ant-unused',
        OPENAI_API_KEY: 'sk-openai-used',
      }),
    );
    expect(result.aiProvider).toBe('openai');
    expect(result.openaiApiKey).toBe('sk-openai-used');
    expect(result.anthropicApiKey).toBe('sk-ant-unused');
  });

  it('defaults allowMockFallback to false when ALLOW_MOCK_FALLBACK is unset', () => {
    const result = buildAppConfig(buildEnv());
    expect(result.allowMockFallback).toBe(false);
  });

  it('accepts ALLOW_MOCK_FALLBACK=true', () => {
    const result = buildAppConfig(buildEnv({ ALLOW_MOCK_FALLBACK: 'true' }));
    expect(result.allowMockFallback).toBe(true);
  });

  it('accepts ALLOW_MOCK_FALLBACK=false', () => {
    const result = buildAppConfig(buildEnv({ ALLOW_MOCK_FALLBACK: 'false' }));
    expect(result.allowMockFallback).toBe(false);
  });

  it('rejects an invalid ALLOW_MOCK_FALLBACK value instead of guessing', () => {
    expect(() => buildAppConfig(buildEnv({ ALLOW_MOCK_FALLBACK: 'yes' }))).toThrow(/ALLOW_MOCK_FALLBACK/);
  });

  it('rejects ALLOW_MOCK_FALLBACK=1 (only the literal strings "true"/"false" are accepted)', () => {
    expect(() => buildAppConfig(buildEnv({ ALLOW_MOCK_FALLBACK: '1' }))).toThrow(/ALLOW_MOCK_FALLBACK/);
  });

  it('defaults port to 4001 and nodeEnv to "development"', () => {
    const result = buildAppConfig(buildEnv());
    expect(result.port).toBe(4001);
    expect(result.nodeEnv).toBe('development');
  });
});
