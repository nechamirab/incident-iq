import type { z } from 'zod';
import type { BiasFindingSchema, BiasTypeSchema, RiskLevelSchema } from '../schemas/bias.schema.js';

export type BiasType = z.infer<typeof BiasTypeSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type BiasFinding = z.infer<typeof BiasFindingSchema>;
