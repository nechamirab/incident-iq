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

export interface MapAnalysisResponseParams {
  incident: Incident;
  response: AiAnalysisResponse;
  providerName: AiProviderName;
  model: string;
  promptVersion: string;
  durationMs: number;
  rawResponse: unknown;
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
  const { incident, response, providerName, model, promptVersion, durationMs, rawResponse } = params;

  const knownEvidenceIds = new Set(incident.evidence.map((item) => item.id));
  const validationWarnings = findUnknownEvidenceReferences(response, knownEvidenceIds);

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

  const facts: ReasoningItem[] = response.facts.map((fact) => ({
    id: createId('reasoning'),
    category: 'fact',
    statement: fact.statement,
    explanation: fact.explanation,
    evidenceIds: fact.evidenceIds,
    confidence: fact.confidence,
    reviewStatus: 'unreviewed',
  }));

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
    new Set([...response.unsupportedClaims, ...detectUnsupportedFacts(response.facts, knownEvidenceIds)]),
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
