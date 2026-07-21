import type { z } from 'zod';
import type { HypothesisSchema, HypothesisStatusSchema } from '../schemas/hypothesis.schema.js';

export type HypothesisStatus = z.infer<typeof HypothesisStatusSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
