import { describe, expect, it } from 'vitest';
import { mapAiResponseToPostmortem } from '../src/ai/mapPostmortemResponse.js';
import { buildValidPostmortemResponse } from './helpers/aiResponseFixtures.js';

function mapWith(overrides: Parameters<typeof buildValidPostmortemResponse>[0] = {}) {
  return mapAiResponseToPostmortem({
    response: buildValidPostmortemResponse(overrides),
    providerName: 'mock',
    model: 'mock-deterministic-v1',
    promptVersion: 'postmortem-v1',
  });
}

describe('mapAiResponseToPostmortem', () => {
  it('carries the AI-provided content through unchanged', () => {
    const postmortem = mapWith({ incidentSummary: 'A custom summary.' });
    expect(postmortem.incidentSummary).toBe('A custom summary.');
  });

  it('stamps the draft with the given provider, model, and prompt version', () => {
    const postmortem = mapWith();
    expect(postmortem.provider).toBe('mock');
    expect(postmortem.model).toBe('mock-deterministic-v1');
    expect(postmortem.promptVersion).toBe('postmortem-v1');
  });

  it('sets a recent generatedAt timestamp', () => {
    const before = Date.now();
    const postmortem = mapWith();
    expect(postmortem.generatedAt).not.toBeNull();
    expect(Date.parse(postmortem.generatedAt as string)).toBeGreaterThanOrEqual(before);
  });

  it('always starts lastEditedAt at null, even conceptually replacing a previously edited draft', () => {
    const postmortem = mapWith();
    expect(postmortem.lastEditedAt).toBeNull();
  });
});
