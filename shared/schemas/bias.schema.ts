import { z } from 'zod';
import { IdSchema } from './common.schema.js';

/** Cognitive biases and reasoning fallacies the system watches for. */
export const BiasTypeSchema = z.enum([
  'confirmation-bias',
  'anchoring-bias',
  'automation-bias',
  'post-hoc-fallacy',
  'availability-bias',
  'overconfidence-bias',
  'hindsight-bias',
  'base-rate-neglect',
]);

export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);

/** A potential reasoning risk detected in an analysis, with a mitigation. */
export const BiasFindingSchema = z.object({
  id: IdSchema,
  biasType: BiasTypeSchema,
  title: z.string().min(1, 'title must not be empty'),
  description: z.string(),
  detectedIn: z.string().min(1, 'detectedIn must not be empty'),
  evidenceIds: z.array(IdSchema),
  riskLevel: RiskLevelSchema,
  mitigation: z.string(),
});
