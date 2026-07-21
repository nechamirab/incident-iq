import type { z } from 'zod';
import type { EvidenceItemSchema, EvidenceSourceTypeSchema } from '../schemas/evidence.schema.js';

export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
