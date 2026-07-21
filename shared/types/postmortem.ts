import type { z } from 'zod';
import type { PostmortemSchema } from '../schemas/postmortem.schema.js';

export type Postmortem = z.infer<typeof PostmortemSchema>;
