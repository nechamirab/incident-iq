import { z } from 'zod';

/**
 * A human-reviewed postmortem draft. Deliberately uses "likely explanation"
 * rather than "confirmed root cause" language unless a human has explicitly
 * confirmed a hypothesis (see {@link HypothesisStatusSchema}'s
 * `confirmed-by-human` state).
 */
export const PostmortemSchema = z.object({
  incidentSummary: z.string().min(1, 'incidentSummary must not be empty'),
  impact: z.string(),
  detection: z.string(),
  timeline: z.string(),
  contributingFactors: z.array(z.string()),
  hypothesesInvestigated: z.array(z.string()),
  likelyCause: z.string(),
  uncertaintyStatement: z.string(),
  resolution: z.string(),
  correctiveActions: z.array(z.string()),
  lessonsLearned: z.array(z.string()),
  followUpItems: z.array(z.string()),
});
