import type { z } from 'zod';
import type { TimelineEventSchema, TimestampTypeSchema } from '../schemas/timeline.schema.js';

export type TimestampType = z.infer<typeof TimestampTypeSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
