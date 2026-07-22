import type { EvidenceItem } from '../../../../shared/types/evidence.js';
import type { Incident } from '../../../../shared/types/incident.js';
import type { AIPrompt } from '../providers/AIProvider.js';

/** Version identifier recorded on every {@link AnalysisRun} this prompt produces. */
export const INCIDENT_ANALYSIS_PROMPT_VERSION = 'incident-analysis-v1';

const RESPONSE_SHAPE_DESCRIPTION = `{
  "summary": { "text": string, "affectedComponents": string[], "impact": string },
  "timeline": [{ "timestamp": string, "title": string, "description": string, "evidenceIds": string[], "timestampType": "exact"|"approximate"|"inferred"|"unknown", "confidence": number, "isInferred": boolean }],
  "facts": [{ "statement": string, "explanation": string, "evidenceIds": string[], "confidence": number }],
  "assumptions": [{ "statement": string, "explanation": string, "evidenceIds": string[], "confidence": number }],
  "hypotheses": [{ "tempId": string, "title": string, "description": string, "confidence": number, "confidenceReason": string, "supportingEvidenceIds": string[], "contradictingEvidenceIds": string[], "assumptions": string[], "recommendedTest": string, "expectedResult": string }],
  "reasoningRisks": [{ "biasType": "confirmation-bias"|"anchoring-bias"|"automation-bias"|"post-hoc-fallacy"|"availability-bias"|"overconfidence-bias"|"hindsight-bias"|"base-rate-neglect", "title": string, "description": string, "detectedIn": string, "evidenceIds": string[], "riskLevel": "low"|"medium"|"high", "mitigation": string }],
  "recommendedActions": [{ "title": string, "description": string, "priority": "immediate"|"high"|"medium"|"low", "category": "inspect"|"reproduce"|"compare"|"rollback"|"monitor"|"communicate"|"collect-evidence"|"configuration-check"|"code-review"|"database-check", "relatedHypothesisIds": string[], "evidenceIds": string[], "expectedOutcome": string, "risk": string }],
  "openQuestions": string[],
  "unsupportedClaims": string[],
  "uncertaintyStatement": string
}`;

/**
 * Purpose: the primary incident-analysis prompt. Given an incident and its
 * full evidence list, asks the model to produce a structured, evidence-
 * grounded analysis (summary, timeline, facts vs. assumptions, at least
 * three falsifiable hypotheses, reasoning risks, recommended actions, and
 * an explicit uncertainty statement) as a single JSON object.
 *
 * Expected input: an {@link Incident} with its `evidence` array populated.
 * Expected output: JSON matching `AiAnalysisResponseSchema`
 * (`server/src/ai/schemas/aiAnalysisResponse.schema.ts`) -- see
 * {@link RESPONSE_SHAPE_DESCRIPTION} for the shape given to the model.
 *
 * Safety/uncertainty instructions: see the system prompt below. The model
 * is instructed to use only the supplied evidence, never invent
 * components or timestamps, avoid deployment-causation bias, separate
 * facts from assumptions, cite evidence ids for every fact, avoid
 * certainty language, and flag statements needing human verification.
 */
export function buildIncidentAnalysisPrompt(incident: Incident): AIPrompt {
  return {
    system: buildSystemPrompt(),
    user: buildUserPrompt(incident),
  };
}

function buildSystemPrompt(): string {
  return [
    'You are an incident-investigation assistant for IncidentIQ, a tool that helps engineering ' +
      'teams reason carefully about production incidents. You support human investigators; you do ' +
      'not replace their judgment, and you must never claim to have found "the" root cause.',
    '',
    'Rules you must follow:',
    '- Use ONLY the evidence supplied in the user message. Never invent system components, ' +
      'services, timestamps, metrics, or events that are not present in the evidence.',
    '- Do not assume a deployment or configuration change caused the incident merely because it ' +
      'occurred earlier in time. Timing alone is not causation.',
    '- Separate facts (directly supported by evidence) from assumptions (plausible but unproven). ' +
      'Every fact must cite the evidence id(s) that support it. If a statement has no supporting ' +
      'evidence, it belongs in "assumptions" or "unsupportedClaims", never in "facts".',
    '- Propose at least three distinct, falsifiable hypotheses. For each, list evidence both for ' +
      'and against it (an empty contradicting list is fine if nothing contradicts it), explain what ' +
      'is missing, and give one concrete, specific recommended test -- never generic advice like ' +
      '"check the logs".',
    '- Confidence scores (0-100) are an investigation aid, not a precise probability. Base them on ' +
      'the amount and strength of supporting evidence, the presence of contradicting evidence, ' +
      'whether timestamps align, and whether the explanation accounts for all reported symptoms.',
    '- Never use language implying certainty ("definitely", "proves", "the root cause is"). Prefer ' +
      '"the available evidence suggests", "a possible explanation is", "this has not been verified".',
    '- Identify open questions and statements that require human verification.',
    '- Every evidence id you cite MUST be one of the exact ids given in the user message. Do not ' +
      'invent evidence ids.',
    '- Each hypothesis needs a short "tempId" you invent (e.g. "H1", "H2", "H3"), unique within your ' +
      'response. When a recommended action relates to a hypothesis, reference it by that tempId in ' +
      '"relatedHypothesisIds".',
    '',
    'Respond with ONLY a single JSON object matching this exact shape -- no markdown code fences, ' +
      'no commentary before or after it:',
    RESPONSE_SHAPE_DESCRIPTION,
  ].join('\n');
}

/** Shared by every prompt builder that needs to list an incident's evidence for the model. */
export function formatEvidenceForPrompt(evidence: readonly EvidenceItem[]): string {
  if (evidence.length === 0) {
    return '(no evidence attached)';
  }

  return evidence
    .map((item) => {
      const timestamp = item.timestamp ?? 'unknown time';
      return `[${item.id}] (${item.sourceType}, ${timestamp}, from "${item.sourceName}"): ${item.normalizedContent}`;
    })
    .join('\n');
}

function buildUserPrompt(incident: Incident): string {
  return [
    `Title: ${incident.title}`,
    `Severity: ${incident.severity}`,
    `Affected service: ${incident.affectedService}`,
    `Started at: ${incident.startedAt ?? 'unknown'}`,
    `Detected at: ${incident.detectedAt}`,
    '',
    'Description:',
    incident.description,
    '',
    `Evidence (${incident.evidence.length} item(s), cite these ids exactly):`,
    formatEvidenceForPrompt(incident.evidence),
  ].join('\n');
}
