import { validateStructuredResponse, type StructuredResponseValidation } from './validateAIResponse.js';
import { AiPostmortemResponseSchema, type AiPostmortemResponse } from '../schemas/postmortemResponse.schema.js';

export type PostmortemResponseValidation = StructuredResponseValidation<AiPostmortemResponse>;

/** Validates a raw AI provider response against {@link AiPostmortemResponseSchema}. */
export function validatePostmortemResponse(rawText: string): PostmortemResponseValidation {
  return validateStructuredResponse(rawText, AiPostmortemResponseSchema);
}
