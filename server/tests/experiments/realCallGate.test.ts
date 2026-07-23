import { describe, expect, it } from 'vitest';
import { evaluateRealCallGate } from '../../src/experiments/realCallGate.js';

const ALLOWED = {
  requested: true,
  runRealAiExperimentsEnabled: true,
  apiKeyConfigured: true,
  approved: true,
};

describe('evaluateRealCallGate', () => {
  it('allows a real call only when every condition is satisfied', () => {
    expect(evaluateRealCallGate(ALLOWED)).toEqual({ allowed: true });
  });

  it('refuses when real calls were not requested', () => {
    const result = evaluateRealCallGate({ ...ALLOWED, requested: false });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/not requested/);
    }
  });

  it('refuses when RUN_REAL_AI_EXPERIMENTS is not enabled, even if everything else is satisfied', () => {
    const result = evaluateRealCallGate({ ...ALLOWED, runRealAiExperimentsEnabled: false });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/RUN_REAL_AI_EXPERIMENTS/);
    }
  });

  it('refuses when no API key is configured for the requested provider', () => {
    const result = evaluateRealCallGate({ ...ALLOWED, apiKeyConfigured: false });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/API key/);
    }
  });

  it('refuses when the call was not explicitly approved', () => {
    const result = evaluateRealCallGate({ ...ALLOWED, approved: false });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/approved/);
    }
  });

  it('never prints or includes any secret value in its reason -- reasons are fixed, static strings', () => {
    for (const overrides of [
      { requested: false },
      { runRealAiExperimentsEnabled: false },
      { apiKeyConfigured: false },
      { approved: false },
    ]) {
      const result = evaluateRealCallGate({ ...ALLOWED, ...overrides });
      if (!result.allowed) {
        expect(result.reason).not.toMatch(/sk-|api[_-]?key\s*[:=]/i);
      }
    }
  });
});
