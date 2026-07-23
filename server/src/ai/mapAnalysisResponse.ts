import type { AnalysisRun, AiProviderName } from '../../../shared/types/analysisRun.js';
import type { BiasFinding } from '../../../shared/types/bias.js';
import type { Hypothesis } from '../../../shared/types/hypothesis.js';
import type { Incident } from '../../../shared/types/incident.js';
import type { RecommendedAction } from '../../../shared/types/action.js';
import type { ReasoningItem } from '../../../shared/types/reasoning.js';
import type { TimelineEvent } from '../../../shared/types/timeline.js';
import { createId } from '../utils/id.js';
import { hashIncidentInput } from '../utils/hashIncidentInput.js';
import type { AiAnalysisResponse } from './schemas/aiAnalysisResponse.schema.js';
import { findUnknownEvidenceReferences } from './validators/evidenceReferenceValidator.js';
import { detectUnsupportedFacts } from './validators/unsupportedClaimDetector.js';
import { evaluateAnalysisQuality } from './validators/analysisQualityEvaluator.js';

export interface MapAnalysisResponseParams {
  incident: Incident;
  response: AiAnalysisResponse;
  providerName: AiProviderName;
  model: string;
  promptVersion: string;
  durationMs: number;
  rawResponse: unknown;
  /** What `AI_PROVIDER` was actually configured to; defaults to `providerName` (i.e. "not a fallback") when omitted. */
  configuredProvider?: AiProviderName;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  providerRequestId?: string | null;
  /** Whether `analysisService` attempted a targeted completion-repair pass on this response. */
  completionRepairAttempted?: boolean;
  /** Which sections the completion-repair pass actually improved, if attempted. */
  completionRepairedSections?: string[];
}

/**
 * Converts a schema-validated {@link AiAnalysisResponse} into a persisted
 * {@link AnalysisRun}: assigns real ids to every nested item (the AI never
 * assigns its own), resolves each hypothesis's AI-invented `tempId` into
 * that real id everywhere it's referenced, force-sets every system-managed
 * field the AI must never control (`reviewStatus: 'unreviewed'`,
 * `status: 'proposed'`/`'suggested'`), and cross-checks every evidence
 * reference against the incident's real evidence set.
 */
export function mapAiResponseToAnalysisRun(params: MapAnalysisResponseParams): AnalysisRun {
  const {
    incident,
    response,
    providerName,
    model,
    promptVersion,
    durationMs,
    rawResponse,
    configuredProvider = providerName,
    fallbackUsed = false,
    fallbackReason = null,
    providerRequestId = null,
    completionRepairAttempted = false,
    completionRepairedSections = [],
  } = params;

  const knownEvidenceIds = new Set(incident.evidence.map((item) => item.id));
  const validationWarnings = findUnknownEvidenceReferences(response, knownEvidenceIds);

  const qualityReport = evaluateAnalysisQuality(response, incident.evidence.length);
  const qualityWarnings = [
    ...qualityReport.completenessWarnings.map((w) => `Completeness: ${w}`),
    ...qualityReport.qualityWarnings.map((w) => `Quality: ${w}`),
  ];

  const hypothesisIdByTempId = new Map<string, string>();
  const hypotheses: Hypothesis[] = response.hypotheses.map((hypothesis) => {
    const id = createId('hypothesis');
    hypothesisIdByTempId.set(hypothesis.tempId, id);
    return {
      id,
      title: hypothesis.title,
      description: hypothesis.description,
      confidence: hypothesis.confidence,
      confidenceReason: hypothesis.confidenceReason,
      supportingEvidenceIds: hypothesis.supportingEvidenceIds,
      contradictingEvidenceIds: hypothesis.contradictingEvidenceIds,
      assumptions: hypothesis.assumptions,
      recommendedTest: hypothesis.recommendedTest,
      expectedResult: hypothesis.expectedResult,
      status: 'proposed',
    };
  });

  /**
   * A fact is only ever kept in the verified `facts` collection if at least
   * one of its cited evidence ids actually belongs to this incident. The
   * AI-facing schema already requires every fact to cite *some* id
   * (`AiFactSchema.evidenceIds.min(1)`), but that alone cannot catch a
   * hallucinated id that merely looks valid -- only cross-checking against
   * the incident's real evidence set (via {@link detectUnsupportedFacts})
   * can. A fact that fails this check is downgraded into
   * `unsupportedClaims` (below) instead of being silently kept as, or
   * silently deleted from, the analysis -- it must never appear as a
   * verified fact to a human investigator, a Markdown export, or a
   * postmortem draft, all of which read only from `facts`. This is the
   * only place that decides fact-vs-unsupported-claim, so the behavior is
   * identical for every provider (mock, Anthropic, OpenAI) and every
   * caller of this mapper.
   */
  const unsupportedResponseFacts = detectUnsupportedFacts(response.facts, knownEvidenceIds);
  const unsupportedResponseFactSet = new Set(unsupportedResponseFacts);

  const facts: ReasoningItem[] = response.facts
    .filter((fact) => !unsupportedResponseFactSet.has(fact))
    .map((fact) => ({
      id: createId('reasoning'),
      category: 'fact' as const,
      statement: fact.statement,
      explanation: fact.explanation,
      evidenceIds: fact.evidenceIds,
      confidence: fact.confidence,
      reviewStatus: 'unreviewed' as const,
    }));

  for (const fact of unsupportedResponseFacts) {
    validationWarnings.push(
      `Fact "${fact.statement}" was moved to unsupportedClaims because none of its cited evidence ` +
        `id(s) [${fact.evidenceIds.join(', ') || '(none)'}] exist on this incident.`,
    );
  }

  const assumptions: ReasoningItem[] = response.assumptions.map((assumption) => ({
    id: createId('reasoning'),
    category: 'assumption',
    statement: assumption.statement,
    explanation: assumption.explanation,
    evidenceIds: assumption.evidenceIds,
    confidence: assumption.confidence,
    reviewStatus: 'unreviewed',
  }));

  const timeline: TimelineEvent[] = response.timeline.map((event) => ({
    id: createId('timeline'),
    timestamp: event.timestamp,
    title: event.title,
    description: event.description,
    evidenceIds: event.evidenceIds,
    timestampType: event.timestampType,
    confidence: event.confidence,
    isInferred: event.isInferred,
  }));

  const reasoningRisks: BiasFinding[] = response.reasoningRisks.map((risk) => ({
    id: createId('bias'),
    biasType: risk.biasType,
    title: risk.title,
    description: risk.description,
    detectedIn: risk.detectedIn,
    evidenceIds: risk.evidenceIds,
    riskLevel: risk.riskLevel,
    mitigation: risk.mitigation,
  }));

  const recommendedActions: RecommendedAction[] = response.recommendedActions.map((action) => {
    const relatedHypothesisIds: string[] = [];
    for (const tempId of action.relatedHypothesisIds) {
      const realId = hypothesisIdByTempId.get(tempId);
      if (realId) {
        relatedHypothesisIds.push(realId);
      } else {
        validationWarnings.push(
          `Recommended action "${action.title}" references unknown hypothesis tempId "${tempId}".`,
        );
      }
    }

    return {
      id: createId('action'),
      title: action.title,
      description: action.description,
      priority: action.priority,
      category: action.category,
      relatedHypothesisIds,
      evidenceIds: action.evidenceIds,
      expectedOutcome: action.expectedOutcome,
      risk: action.risk,
      status: 'suggested',
    };
  });

  const unsupportedClaims = Array.from(
    new Set([...response.unsupportedClaims, ...unsupportedResponseFacts.map((fact) => fact.statement)]),
  );

  return {
    id: createId('run'),
    incidentId: incident.id,
    provider: providerName,
    model,
    promptVersion,
    createdAt: new Date().toISOString(),
    inputHash: hashIncidentInput(incident),
    durationMs,
    configuredProvider,
    fallbackUsed,
    fallbackReason,
    providerRequestId,
    completionRepairAttempted,
    completionRepairedSections,
    qualityWarnings,
    status: 'completed',
    summary: response.summary,
    timeline,
    facts,
    assumptions,
    hypotheses,
    reasoningRisks,
    recommendedActions,
    openQuestions: response.openQuestions,
    unsupportedClaims,
    uncertaintyStatement: response.uncertaintyStatement,
    validationWarnings,
    rawResponse,
  };
}
