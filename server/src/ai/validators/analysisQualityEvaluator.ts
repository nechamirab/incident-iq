import type { AiAnalysisResponse, AiRecommendedAction } from '../schemas/aiAnalysisResponse.schema.js';

/**
 * Result of {@link evaluateAnalysisQuality}. Deliberately has no `valid`/
 * `invalid` verdict: unlike schema validation (which can reject a
 * response outright) or evidence-integrity checks (which can only ever
 * remove/downgrade a specific hallucinated item), quality issues are
 * genuinely a matter of degree -- an incident can legitimately have no
 * contradicting evidence or no detectable bias, and that must never be
 * treated as a failure. Both fields are advisory, surfaced to a human
 * investigator via `AnalysisRun.qualityWarnings`, never used to reject or
 * silently alter a response.
 */
export interface AnalysisQualityReport {
  /** Missing or empty sections a complete analysis would normally have. */
  completenessWarnings: string[];
  /** Content-quality concerns that don't imply anything is missing outright. */
  qualityWarnings: string[];
}

/** Deficiency kinds {@link evaluateAnalysisQuality} can detect, used to decide whether a targeted completion-repair pass is worth attempting (see `targetedCompletionRepairV1.ts`). */
export type CompletionDeficiency =
  | 'empty-reasoning-risks'
  | 'empty-recommended-actions'
  | 'all-hypotheses-missing-contradicting-evidence'
  | 'empty-open-questions'
  | 'trivial-uncertainty-statement';

const GENERIC_ACTION_PHRASES = [
  'check the logs',
  'check logs',
  'investigate further',
  'debug the issue',
  'monitor the system',
  'look into it',
  'review the code',
];

const OVERCONFIDENT_PHRASES = [
  'definitely caused',
  'proven cause',
  'the definitive root cause',
  'ai found the cause',
  'certainly caused by',
  'confirmed by ai',
  '100% certain',
  'without a doubt',
];

/** Below this many total evidence items, a "rich evidence set" is not assumed -- see `all-hypotheses-missing-contradicting-evidence`. */
const RICH_EVIDENCE_THRESHOLD = 5;

function isGenericAction(action: AiRecommendedAction): boolean {
  const text = `${action.title} ${action.description}`.toLowerCase();
  const matchesGenericPhrase = GENERIC_ACTION_PHRASES.some((phrase) => text.includes(phrase));
  const hasNoConcreteLink = action.evidenceIds.length === 0 && action.relatedHypothesisIds.length === 0;
  return matchesGenericPhrase && hasNoConcreteLink;
}

function findOverconfidentLanguage(response: AiAnalysisResponse): string[] {
  const haystacks = [
    response.summary.text,
    response.summary.impact,
    response.uncertaintyStatement,
    ...response.hypotheses.map((h) => h.description),
    ...response.hypotheses.map((h) => h.confidenceReason),
  ];
  const found = new Set<string>();
  for (const text of haystacks) {
    const lower = text.toLowerCase();
    for (const phrase of OVERCONFIDENT_PHRASES) {
      if (lower.includes(phrase)) {
        found.add(phrase);
      }
    }
  }
  return Array.from(found);
}

/**
 * Provider-independent quality gate run *after* structured-response and
 * evidence-integrity validation both already succeeded. Never invalidates
 * a response and never mutates it -- it only produces advisory warnings a
 * human investigator (or {@link import('../prompts/targetedCompletionRepairV1.js').buildTargetedCompletionRepairPrompt})
 * can act on. Applies identically to every provider, since it only reads
 * the already-validated {@link AiAnalysisResponse}.
 *
 * @param response A schema-validated, evidence-integrity-checked AI analysis response.
 * @param evidenceCount The incident's total evidence item count, used to judge whether "no contradicting evidence anywhere" is worth flagging.
 */
export function evaluateAnalysisQuality(
  response: AiAnalysisResponse,
  evidenceCount: number,
): AnalysisQualityReport {
  const completenessWarnings: string[] = [];
  const qualityWarnings: string[] = [];

  if (response.hypotheses.length < 3) {
    // Not reachable through a schema-valid response today (the AI-facing
    // schema requires `.min(3)`), but kept as a defensive completeness
    // check in case that constraint is ever relaxed.
    completenessWarnings.push(
      `Only ${response.hypotheses.length} hypothesis/hypotheses were generated; at least 3 are expected.`,
    );
  }

  if (response.reasoningRisks.length === 0) {
    completenessWarnings.push('No reasoning risks (biases/fallacies) were identified for this analysis.');
  }

  if (response.recommendedActions.length === 0) {
    completenessWarnings.push('No recommended actions were generated for this analysis.');
  }

  if (response.openQuestions.length === 0) {
    completenessWarnings.push('No open questions were identified for this analysis.');
  }

  if (response.uncertaintyStatement.trim().length < 15) {
    completenessWarnings.push('The uncertainty statement is missing or too brief to be meaningful.');
  }

  const allHypothesesLackContradictingEvidence = response.hypotheses.every(
    (h) => h.contradictingEvidenceIds.length === 0,
  );
  if (allHypothesesLackContradictingEvidence && evidenceCount >= RICH_EVIDENCE_THRESHOLD) {
    qualityWarnings.push(
      `Every hypothesis has an empty contradicting-evidence list, despite ${evidenceCount} evidence ` +
        'items being available -- this may indicate confirmation bias in the analysis itself, or that ' +
        'contradicting evidence genuinely was not actively sought.',
    );
  }

  const genericActions = response.recommendedActions.filter(isGenericAction);
  if (genericActions.length > 0) {
    qualityWarnings.push(
      `${genericActions.length} recommended action(s) are generic (e.g. "check the logs") and not ` +
        'linked to any specific evidence or hypothesis: ' +
        genericActions.map((a) => `"${a.title}"`).join(', '),
    );
  }

  const overconfidentPhrases = findOverconfidentLanguage(response);
  if (overconfidentPhrases.length > 0) {
    qualityWarnings.push(
      `Language implying unwarranted certainty was found: ${overconfidentPhrases.map((p) => `"${p}"`).join(', ')}.`,
    );
  }

  return { completenessWarnings, qualityWarnings };
}

/**
 * Reduces a {@link AnalysisQualityReport} to the specific, individually
 * repairable deficiencies a targeted completion-repair pass can address --
 * only the subset of completeness issues that have a corresponding
 * section a repair prompt can request (excludes free-text quality
 * observations like generic actions or overconfident language, which a
 * single targeted repair request is not well-suited to fix safely).
 */
export function identifyRepairableDeficiencies(
  response: AiAnalysisResponse,
  evidenceCount: number,
): CompletionDeficiency[] {
  const deficiencies: CompletionDeficiency[] = [];

  if (response.reasoningRisks.length === 0) {
    deficiencies.push('empty-reasoning-risks');
  }
  if (response.recommendedActions.length === 0) {
    deficiencies.push('empty-recommended-actions');
  }
  if (response.openQuestions.length === 0) {
    deficiencies.push('empty-open-questions');
  }
  if (response.uncertaintyStatement.trim().length < 15) {
    deficiencies.push('trivial-uncertainty-statement');
  }
  const allHypothesesLackContradictingEvidence = response.hypotheses.every(
    (h) => h.contradictingEvidenceIds.length === 0,
  );
  if (allHypothesesLackContradictingEvidence && evidenceCount >= RICH_EVIDENCE_THRESHOLD) {
    deficiencies.push('all-hypotheses-missing-contradicting-evidence');
  }

  return deficiencies;
}
