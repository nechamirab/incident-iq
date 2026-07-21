import { describe, expect, it } from 'vitest';
import { AiAnalysisResponseSchema } from '../src/ai/schemas/aiAnalysisResponse.schema.js';
import { buildValidAiResponse } from './helpers/aiResponseFixtures.js';

describe('AiAnalysisResponseSchema', () => {
  it('accepts a well-formed response', () => {
    const result = AiAnalysisResponseSchema.safeParse(buildValidAiResponse());
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
  });

  it('rejects a response with fewer than three hypotheses', () => {
    const response = buildValidAiResponse();
    const result = AiAnalysisResponseSchema.safeParse({
      ...response,
      hypotheses: response.hypotheses.slice(0, 2),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a response with duplicate hypothesis tempIds', () => {
    const response = buildValidAiResponse();
    const result = AiAnalysisResponseSchema.safeParse({
      ...response,
      hypotheses: response.hypotheses.map((h) => ({ ...h, tempId: 'H1' })),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a fact with no evidence ids', () => {
    const response = buildValidAiResponse();
    const result = AiAnalysisResponseSchema.safeParse({
      ...response,
      facts: [{ ...response.facts[0], evidenceIds: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an assumption with no evidence ids', () => {
    const response = buildValidAiResponse({
      assumptions: [
        {
          statement: 'Maybe this is related.',
          explanation: 'Speculative.',
          evidenceIds: [],
          confidence: 20,
        },
      ],
    });
    expect(AiAnalysisResponseSchema.safeParse(response).success).toBe(true);
  });

  it('rejects a missing uncertaintyStatement', () => {
    const response = buildValidAiResponse({ uncertaintyStatement: '' });
    expect(AiAnalysisResponseSchema.safeParse(response).success).toBe(false);
  });

  it('rejects confidence values outside 0-100', () => {
    const response = buildValidAiResponse();
    const result = AiAnalysisResponseSchema.safeParse({
      ...response,
      facts: [{ ...response.facts[0], confidence: 150 }],
    });
    expect(result.success).toBe(false);
  });
});
