import { describe, expect, it } from 'vitest';
import { validateAIResponse } from '../src/ai/validators/validateAIResponse.js';
import { buildValidAiResponse } from './helpers/aiResponseFixtures.js';

describe('validateAIResponse', () => {
  it('accepts a well-formed JSON response', () => {
    const result = validateAIResponse(JSON.stringify(buildValidAiResponse()));
    expect(result.success).toBe(true);
  });

  it('strips a wrapping markdown ```json code fence', () => {
    const text = '```json\n' + JSON.stringify(buildValidAiResponse()) + '\n```';
    const result = validateAIResponse(text);
    expect(result.success).toBe(true);
  });

  it('strips a wrapping plain ``` code fence', () => {
    const text = '```\n' + JSON.stringify(buildValidAiResponse()) + '\n```';
    const result = validateAIResponse(text);
    expect(result.success).toBe(true);
  });

  it('extracts JSON surrounded by stray commentary', () => {
    const text = `Sure, here is the analysis:\n${JSON.stringify(buildValidAiResponse())}\nLet me know if you need anything else.`;
    const result = validateAIResponse(text);
    expect(result.success).toBe(true);
  });

  it('reports a failure for text that is not JSON at all', () => {
    const result = validateAIResponse('This is not JSON.');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toMatch(/not valid JSON/i);
    }
  });

  it('reports a failure for JSON that does not match the schema', () => {
    const result = validateAIResponse(JSON.stringify({ foo: 'bar' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});
