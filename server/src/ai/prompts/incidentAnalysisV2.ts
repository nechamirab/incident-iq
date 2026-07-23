import type { Incident } from '../../../../shared/types/incident.js';
import type { AIPrompt } from '../providers/AIProvider.js';
import { formatEvidenceForPrompt } from './incidentAnalysisV1.js';

/** Version identifier recorded on every {@link AnalysisRun} this prompt produces. */
export const INCIDENT_ANALYSIS_V2_PROMPT_VERSION = 'incident-analysis-v2';

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
 * A short, clearly-synthetic illustration of the *depth* expected in a few
 * fields, using an incident domain (an email-delivery delay) deliberately
 * unrelated to any bundled sample scenario. This exists to demonstrate the
 * required grounding/specificity, not to be copied -- the model is
 * explicitly told below that its own response must come entirely from the
 * real incident and evidence, never from this example's content, wording,
 * bias types, or hypotheses.
 */
const FEW_SHOT_EXAMPLE = `Illustrative example only (a different, synthetic incident) -- shows the
expected DEPTH, not content to copy:

Evidence given in that example: [example-ev-01] "queue depth alert fired", [example-ev-02] "worker
pod count reduced in today's deploy".

A good hypothesis from that example:
{
  "tempId": "H1",
  "title": "Reduced worker pod count is limiting delivery throughput",
  "confidence": 55,
  "confidenceReason": "Supported by the pod-count reduction and the queue-depth alert, but no
    contradicting evidence was actively found despite checking whether producer volume also
    changed -- it did not, which somewhat weakens alternative explanations without confirming
    this one.",
  "supportingEvidenceIds": ["example-ev-02"],
  "contradictingEvidenceIds": [],
  ...
}

Notice: the confidenceReason explicitly states that contradicting evidence was searched for and
none was found, rather than silently leaving the array empty with no explanation. Do this in your
own response whenever a hypothesis has no contradicting evidence.`;

/**
 * Purpose: an improved incident-analysis prompt (see
 * `incidentAnalysisV1.ts`, preserved unchanged for prompt-comparison
 * experiments -- see `docs/experiments/`). v2 keeps the same required JSON
 * shape and safety rules as v1, but adds explicit instructions targeting
 * weaknesses observed in real-provider output during manual verification
 * (recorded in `docs/requirements-compliance-audit.md`): hypotheses
 * returned with no contradicting evidence and no explanation why, an empty
 * `reasoningRisks` array, and occasionally an empty `recommendedActions`
 * array. v2 does not change the schema and does not force the model to
 * fabricate content that genuinely doesn't apply to a given incident.
 *
 * Expected output: JSON matching `AiAnalysisResponseSchema`, identical to
 * v1 -- see {@link RESPONSE_SHAPE_DESCRIPTION}.
 */
export function buildIncidentAnalysisPromptV2(incident: Incident): AIPrompt {
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
    '1. Use ONLY the evidence supplied in the user message. Never invent system components, ' +
      'services, timestamps, metrics, evidence ids, or events that are not present in the evidence.',
    '2. Separate Facts, Assumptions, Hypotheses, and Actions strictly. Every fact must cite the ' +
      'evidence id(s) that support it; a statement with no supporting evidence belongs in ' +
      '"assumptions" or "unsupportedClaims", never in "facts".',
    '3. Propose at least three distinct, falsifiable hypotheses.',
    '4. For EACH hypothesis, actively search the evidence for anything that would weaken or ' +
      'contradict it -- do not stop at the first supporting item. This is a deliberate, separate ' +
      'step from finding supporting evidence, not an afterthought.',
    '5. When you find contradicting evidence for a hypothesis, cite it in "contradictingEvidenceIds".',
    '6. When you do NOT find any contradicting evidence for a hypothesis after actively looking, ' +
      'say so explicitly inside "confidenceReason" (e.g. "no contradicting evidence was found ' +
      'despite checking whether X also changed") -- never leave an empty ' +
      '"contradictingEvidenceIds" array unexplained when the incident has a non-trivial amount of ' +
      'evidence.',
    '7. Identify reasoning risks (biases/fallacies) that are actually relevant to THIS incident\'s ' +
      'specific evidence and hypotheses -- ground each one in what actually appears in the ' +
      'evidence (via "detectedIn" and "evidenceIds"), rather than returning a generic list. It is ' +
      'correct to return zero reasoning risks only if none genuinely apply after real ' +
      'consideration; do not fabricate one merely to fill the array.',
    '8. Generate concrete recommended actions. Every action must reference at least one evidence ' +
      'id, hypothesis tempId (via "relatedHypothesisIds"), or open question -- and must name a ' +
      'specific metric, component, comparison, or time range. Never output generic advice such as ' +
      '"check the logs", "investigate further", "debug the issue", or "monitor the system" with no ' +
      'further detail.',
    '9. Never use language implying certainty ("definitely", "proves", "the root cause is", ' +
      '"confirmed"). Prefer "the available evidence suggests", "a possible explanation is", "this ' +
      'has not been verified".',
    '10. Explicitly state what evidence is missing or would help confirm/rule out each hypothesis, ' +
      'via "openQuestions" and each hypothesis\'s own fields.',
    '11. Do not assume a deployment or configuration change caused the incident merely because it ' +
      'occurred earlier in time -- timing alone is not causation. Explain, when relevant, what ' +
      'additional evidence would distinguish coincidence from cause.',
    '12. Do not present a correlation (two things happening around the same time) as if it were a ' +
      'proven causal relationship anywhere in your response.',
    '13. Only use bias types from this exact list: confirmation-bias, anchoring-bias, ' +
      'automation-bias, post-hoc-fallacy, availability-bias, overconfidence-bias, hindsight-bias, ' +
      'base-rate-neglect. Never invent a different bias name.',
    '14. Never invent evidence ids or timestamps not present in the evidence given to you.',
    '15. Each hypothesis needs a short "tempId" you invent (e.g. "H1", "H2", "H3"), unique within ' +
      'your response. Reference it by that tempId in "relatedHypothesisIds" on any related action.',
    '',
    FEW_SHOT_EXAMPLE,
    '',
    'Respond with ONLY a single JSON object matching this exact shape -- no markdown code fences, ' +
      'no commentary before or after it:',
    RESPONSE_SHAPE_DESCRIPTION,
  ].join('\n');
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
