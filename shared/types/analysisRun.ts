import type { z } from 'zod';
import type {
  AiProviderNameSchema,
  AnalysisRunSchema,
  AnalysisRunStatusSchema,
  AnalysisRunSummarySchema,
} from '../schemas/analysisRun.schema.js';

export type AiProviderName = z.infer<typeof AiProviderNameSchema>;
export type AnalysisRunStatus = z.infer<typeof AnalysisRunStatusSchema>;
export type AnalysisRunSummary = z.infer<typeof AnalysisRunSummarySchema>;
export type AnalysisRun = z.infer<typeof AnalysisRunSchema>;
