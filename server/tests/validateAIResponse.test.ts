import { describe, expect, it } from 'vitest';
import { validateAIResponse } from '../src/ai/validators/validateAIResponse.js';
import { validateSkepticReviewResponse } from '../src/ai/validators/validateSkepticReviewResponse.js';
import { buildValidAiResponse, buildValidSkepticReviewResponse } from './helpers/aiResponseFixtures.js';

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

describe('validateSkepticReviewResponse', () => {
  it('accepts a well-formed JSON response', () => {
    const result = validateSkepticReviewResponse(JSON.stringify(buildValidSkepticReviewResponse()));
    expect(result.success).toBe(true);
  });

  it('strips a wrapping markdown ```json code fence', () => {
    const text = '```json\n' + JSON.stringify(buildValidSkepticReviewResponse()) + '\n```';
    const result = validateSkepticReviewResponse(text);
    expect(result.success).toBe(true);
  });

  it('reports a failure for text that is not JSON at all', () => {
    const result = validateSkepticReviewResponse('This is not JSON.');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toMatch(/not valid JSON/i);
    }
  });

  it('reports a failure when a required field is missing', () => {
    const { challengeSummary: _omitted, ...withoutChallengeSummary } = buildValidSkepticReviewResponse();
    const result = validateSkepticReviewResponse(JSON.stringify(withoutChallengeSummary));
    expect(result.success).toBe(false);
  });

  it('does not require challengedHypothesisId or ignoredEvidenceIds from the AI', () => {
    const response = buildValidSkepticReviewResponse();
    // The mock/real AI response never includes these -- the backend computes
    // them itself. Confirms extra fields don't break validation either.
    const result = validateSkepticReviewResponse(
      JSON.stringify({ ...response, challengedHypothesisId: 'ignored-if-present' }),
    );
    expect(result.success).toBe(true);
  });
});
