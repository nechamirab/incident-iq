import type { AIPrompt } from '../providers/AIProvider.js';
import type { CompletionDeficiency } from '../validators/analysisQualityEvaluator.js';

/** Version identifier recorded when a run's final content came from a completion-repair pass. */
export const TARGETED_COMPLETION_REPAIR_PROMPT_VERSION = 'targeted-completion-repair-v1';

const DEFICIENCY_DESCRIPTIONS: Record<CompletionDeficiency, string> = {
  'empty-reasoning-risks':
    '"reasoningRisks" is empty. Look again at the evidence and hypotheses for genuinely applicable ' +
    'reasoning risks (confirmation bias, anchoring bias, automation bias, post-hoc fallacy, ' +
    'availability bias, overconfidence bias, hindsight bias, base-rate neglect). If, after real ' +
    'consideration, none genuinely apply, you may leave it empty again -- do not fabricate one.',
  'empty-recommended-actions':
    '"recommendedActions" is empty. Add at least one concrete, evidence-or-hypothesis-linked action ' +
    '(never generic advice like "check the logs").',
  'all-hypotheses-missing-contradicting-evidence':
    'Every hypothesis has an empty "contradictingEvidenceIds". Re-examine the evidence specifically ' +
    'looking for anything that weakens each hypothesis. If you still find none for a given ' +
    'hypothesis after actively looking, explain that explicitly in its "confidenceReason" instead ' +
    'of leaving it unexplained.',
  'empty-open-questions':
    '"openQuestions" is empty. Identify at least one genuine open question -- information that ' +
    'would help confirm or rule out a hypothesis but is not present in the evidence given.',
  'trivial-uncertainty-statement':
    '"uncertaintyStatement" is missing or too brief to be meaningful. Write a substantive statement ' +
    'of what remains uncertain about this analysis.',
};

/**
 * Builds a targeted, single-shot repair prompt for a response that already
 * passed structured-output validation but was found incomplete by
 * {@link import('../validators/analysisQualityEvaluator.js').evaluateAnalysisQuality}.
 * Distinct from `repairInvalidJsonV1.ts`, which repairs a response that
 * failed *schema* validation -- this repairs a schema-valid response that
 * is merely thin in specific, named sections.
 *
 * The model is asked to return the full response again (same shape,
 * validated with the same Zod schema as the original request), but is
 * explicitly told which sections to improve and which to leave untouched,
 * and is re-given the exact known evidence ids so it cannot invent new
 * ones while trying to fill a gap.
 *
 * @param originalPrompt The prompt that produced the response being repaired.
 * @param originalResponseText The provider's raw (already schema-valid) response text.
 * @param deficiencies Which specific sections were found incomplete.
 * @param knownEvidenceIds The incident's real evidence ids, restated for grounding.
 */
export function buildTargetedCompletionRepairPrompt(
  originalPrompt: AIPrompt,
  originalResponseText: string,
  deficiencies: readonly CompletionDeficiency[],
  knownEvidenceIds: readonly string[],
): AIPrompt {
  const deficiencyList = deficiencies.map((d) => `- ${DEFICIENCY_DESCRIPTIONS[d]}`).join('\n');

  const system = [
    originalPrompt.system,
    '',
    'IMPORTANT -- this is a targeted completion-repair request, not a new analysis:',
    '- Your previous response below was structurally valid but incomplete in specific ways.',
    '- Return a COMPLETE JSON object in the exact same shape as before.',
    '- Improve ONLY the section(s) listed below. Copy every other field from your previous ' +
      'response UNCHANGED, including "facts" and "summary" -- do not alter already-supported facts ' +
      'unless you discover one of them cites an evidence id that is not in the list below, in ' +
      'which case correct or remove only that citation.',
    '- Do not invent new evidence ids. The only valid evidence ids are:',
    knownEvidenceIds.length > 0 ? knownEvidenceIds.join(', ') : '(none)',
    '- If, after genuinely reconsidering, a section still has nothing grounded to add, it is ' +
      'correct to return it unchanged (e.g. still empty) rather than inventing content.',
  ].join('\n');

  const user = [
    'Sections to improve:',
    deficiencyList,
    '',
    'Your previous response:',
    originalResponseText,
    '',
    'Original request context:',
    originalPrompt.user,
  ].join('\n');

  return { system, user };
}
