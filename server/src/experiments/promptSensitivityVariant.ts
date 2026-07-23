import type { Incident } from '../../../shared/types/incident.js';
import { buildIncidentAnalysisPromptV2 } from '../ai/prompts/incidentAnalysisV2.js';
import type { AIPrompt } from '../ai/providers/AIProvider.js';

/**
 * Version identifier for Experiment C's prompt-sensitivity variant. Never
 * used by `analysisService`/any production code path -- this exists solely
 * for the critical-AI-experiment framework (see `docs/experiments/`) to
 * measure how much a single added instruction changes a real model's
 * output, holding the evidence and response schema fixed.
 */
export const ARGUE_AGAINST_FIRST_CAUSE_VARIANT_VERSION = 'incident-analysis-v2-argue-against-variant';

const ARGUE_AGAINST_INSTRUCTION = [
  '',
  'ADDITIONAL INSTRUCTION FOR THIS REQUEST (prompt-sensitivity experiment variant): before finalizing ' +
    'your hypotheses, deliberately argue AGAINST the single most obvious apparent cause suggested by ' +
    "the evidence's surface-level narrative (for example, the most recent deployment, or whichever " +
    'single evidence item is most numerous or most prominent). Actively look for evidence that this ' +
    'obvious-looking explanation is incomplete, coincidental, or wrong, and reflect that search in ' +
    'your hypotheses, confidence scores, and contradicting evidence -- without inventing evidence that ' +
    'is not present. This instruction changes how hard you must look for contradicting evidence; it ' +
    'does not change the required JSON response shape or any other rule above.',
].join('\n');

/**
 * Purpose: Experiment C's prompt-sensitivity variant of `incident-analysis-v2`
 * -- identical in every respect (schema, safety rules, few-shot example)
 * except for one added instruction pushing the model to actively argue
 * against the most obvious apparent cause. Used only to compare a real
 * provider's output against the standard v2 prompt on the same evidence;
 * never presented as a production prompt version.
 *
 * Expected output: JSON matching the same `AiAnalysisResponseSchema` as v2.
 */
export function buildArgueAgainstFirstCausePrompt(incident: Incident): AIPrompt {
  const base = buildIncidentAnalysisPromptV2(incident);
  return {
    system: base.system + ARGUE_AGAINST_INSTRUCTION,
    user: base.user,
  };
}
