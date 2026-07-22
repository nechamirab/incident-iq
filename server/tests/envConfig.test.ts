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

  it('rejects an unsupported AI_PROVIDER value', () => {
    expect(() => buildAppConfig(buildEnv({ AI_PROVIDER: 'openai' }))).toThrow(/AI_PROVIDER/);
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
