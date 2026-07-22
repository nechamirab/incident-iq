import { validateStructuredResponse, type StructuredResponseValidation } from './validateAIResponse.js';
import {
  AiSkepticReviewResponseSchema,
  type AiSkepticReviewResponse,
} from '../schemas/skepticReviewResponse.schema.js';

export type SkepticReviewResponseValidation = StructuredResponseValidation<AiSkepticReviewResponse>;

/** Validates a raw AI provider response against {@link AiSkepticReviewResponseSchema}. */
export function validateSkepticReviewResponse(rawText: string): SkepticReviewResponseValidation {
  return validateStructuredResponse(rawText, AiSkepticReviewResponseSchema);
}
