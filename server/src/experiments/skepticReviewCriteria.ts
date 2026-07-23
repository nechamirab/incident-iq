import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { AiSkepticReviewResponse } from '../ai/schemas/skepticReviewResponse.schema.js';
import { findLeadingHypothesis } from '../ai/prompts/skepticReviewV1.js';

/** Generic phrasing a genuinely concrete recommended test/falsification condition should not consist entirely of. */
const GENERIC_TEST_PHRASES = [
  'investigate further',
  'check the logs',
  'look into it',
  'do more research',
  'monitor the system',
  'review the code',
];

/** Phrasing that would imply unwarranted certainty in a review meant to highlight gaps, not issue a verdict. */
const OVERCONFIDENT_PHRASES = [
  'definitely caused',
  'proven cause',
  'the definitive root cause',
  'certainly caused by',
  'confirmed by ai',
  '100% certain',
  'without a doubt',
];

export interface SkepticReviewCriterionResult {
  id: string;
  description: string;
  passed: boolean;
  detail: string;
}

function isGenericPhraseOnly(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return GENERIC_TEST_PHRASES.some((phrase) => lower === phrase || lower === `${phrase}.`);
}

/**
 * Evaluates a skeptic review against six fixed, mechanically-checkable
 * criteria for what makes a review actually useful rather than a rubber
 * stamp -- Experiment D. Every criterion is derived directly from
 * `skepticReviewV1.ts`'s own stated rules (challenge the leading hypothesis
 * by name, do not simply restate it, propose alternatives, assess
 * confirmation bias, state a concrete falsification condition, recommend
 * concrete tests, avoid certainty language), so this evaluates whether the
 * response actually followed its own prompt -- not an external standard
 * invented after the fact.
 *
 * Deliberately provider-independent and safe to run against mock output:
 * `MockAIProvider`'s skeptic review is a real, non-trivial function of the
 * run being reviewed (see `buildMockSkepticReview`), so this is meaningful
 * even without a real provider call, unlike the prompt-comparison
 * experiments (see `promptSensitivityVariant.ts`'s doc comment).
 *
 * @param review The schema-validated skeptic review response to evaluate.
 * @param run The analysis run that review was produced for.
 */
export function evaluateSkepticReviewCriteria(
  review: AiSkepticReviewResponse,
  run: AnalysisRun,
): SkepticReviewCriterionResult[] {
  const leading = findLeadingHypothesis(run);
  const leadingTitleMentioned = review.challengeSummary.toLowerCase().includes(leading.title.toLowerCase());

  const concreteRecommendedTests = review.recommendedTests.filter((test) => !isGenericPhraseOnly(test));

  const allText = [
    review.challengeSummary,
    review.confirmationBiasAssessment,
    review.falsificationTest,
    review.overallAssessment,
    ...review.alternativeExplanations,
    ...review.recommendedTests,
  ]
    .join(' ')
    .toLowerCase();
  const overconfidentPhrasesFound = OVERCONFIDENT_PHRASES.filter((phrase) => allText.includes(phrase));

  return [
    {
      id: 'challenges-leading-hypothesis-by-name',
      description: 'The challenge summary names and directly addresses the leading hypothesis, rather than a generic critique.',
      passed: leadingTitleMentioned,
      detail: leadingTitleMentioned
        ? `challengeSummary references "${leading.title}".`
        : `challengeSummary does not mention the leading hypothesis's title ("${leading.title}").`,
    },
    {
      id: 'proposes-alternative-explanation',
      description: 'At least one alternative explanation is proposed.',
      passed: review.alternativeExplanations.length > 0,
      detail: `${review.alternativeExplanations.length} alternative explanation(s) proposed.`,
    },
    {
      id: 'addresses-confirmation-bias',
      description: 'The confirmation-bias assessment is substantive, not a placeholder.',
      passed: review.confirmationBiasAssessment.trim().length >= 20,
      detail: `confirmationBiasAssessment is ${review.confirmationBiasAssessment.trim().length} character(s) long.`,
    },
    {
      id: 'states-concrete-falsification-test',
      description: 'The falsification test is a concrete, non-generic condition.',
      passed: review.falsificationTest.trim().length >= 20 && !isGenericPhraseOnly(review.falsificationTest),
      detail: isGenericPhraseOnly(review.falsificationTest)
        ? 'falsificationTest is a generic phrase with no concrete condition.'
        : `falsificationTest is ${review.falsificationTest.trim().length} character(s) long.`,
    },
    {
      id: 'recommends-concrete-tests',
      description: 'At least one recommended test is concrete rather than generic advice.',
      passed: concreteRecommendedTests.length > 0,
      detail: `${concreteRecommendedTests.length} of ${review.recommendedTests.length} recommended test(s) are concrete.`,
    },
    {
      id: 'avoids-overconfident-language',
      description: 'No language implying unwarranted certainty appears anywhere in the review.',
      passed: overconfidentPhrasesFound.length === 0,
      detail:
        overconfidentPhrasesFound.length === 0
          ? 'No overconfident phrases found.'
          : `Found: ${overconfidentPhrasesFound.map((p) => `"${p}"`).join(', ')}.`,
    },
  ];
}
