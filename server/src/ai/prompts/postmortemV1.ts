import type { AnalysisRun } from '../../../../shared/types/analysisRun.js';
import type { Incident } from '../../../../shared/types/incident.js';
import type { AIPrompt } from '../providers/AIProvider.js';
import { findLeadingHypothesis } from './skepticReviewV1.js';
import { formatEvidenceForPrompt } from './incidentAnalysisV1.js';

/** Version identifier recorded on every {@link Postmortem} draft this prompt produces. */
export const POSTMORTEM_PROMPT_VERSION = 'postmortem-v1';

const RESPONSE_SHAPE_DESCRIPTION = `{
  "incidentSummary": string,
  "impact": string,
  "detection": string,
  "timeline": string,
  "contributingFactors": string[],
  "hypothesesInvestigated": string[],
  "likelyCause": string,
  "uncertaintyStatement": string,
  "resolution": string,
  "correctiveActions": string[],
  "lessonsLearned": string[],
  "followUpItems": string[]
}`;

/**
 * Purpose: the postmortem-draft prompt. Given an incident and one of its
 * completed analysis runs, asks the model to draft a full postmortem
 * document a human can then edit in place -- never to state a "confirmed
 * root cause" unless a hypothesis already carries `status:
 * 'confirmed-by-human'` (a human review action the AI itself can never
 * take, so most drafts should stay in "likely cause" language).
 *
 * Expected output: JSON matching `AiPostmortemResponseSchema` -- see
 * {@link RESPONSE_SHAPE_DESCRIPTION}.
 */
export function buildPostmortemPrompt(incident: Incident, run: AnalysisRun): AIPrompt {
  return {
    system: buildSystemPrompt(),
    user: buildUserPrompt(incident, run),
  };
}

function buildSystemPrompt(): string {
  return [
    'You are drafting a postmortem for IncidentIQ, an incident-investigation tool. A human will ' +
      'review and edit every field of this draft before it is final -- your job is to produce a ' +
      'strong, evidence-grounded starting point, not a finished document.',
    '',
    'Rules you must follow:',
    '- Use ONLY the incident and analysis run supplied in the user message. Never invent details, ' +
      'metrics, or events not present there.',
    '- "likelyCause" must use hedged language ("the available evidence suggests...", "the most ' +
      'likely explanation is...") UNLESS a hypothesis is explicitly marked confirmed-by-human in ' +
      'the user message, in which case you may state it as the confirmed cause while still crediting ' +
      'that it was human-confirmed.',
    '- "hypothesesInvestigated" must list every hypothesis from the run, not only the leading one, ' +
      'each noting its confidence and whether it was ultimately supported.',
    '- "resolution" must explicitly say the incident has not yet been resolved if its status is not ' +
      '"resolved" -- never invent a resolution that has not happened.',
    '- "correctiveActions" should be drawn from the run\'s recommended actions; "followUpItems" ' +
      'should be drawn from its open questions. Do not repeat the same content in both.',
    '- "lessonsLearned" should be grounded in the specific reasoning risks this analysis flagged ' +
      'about itself, not generic advice.',
    '- Never use language implying certainty beyond what a human has confirmed.',
    '',
    'Respond with ONLY a single JSON object matching this exact shape -- no markdown code fences, ' +
      'no commentary before or after it:',
    RESPONSE_SHAPE_DESCRIPTION,
  ].join('\n');
}

function formatHypothesisForPrompt(hypothesis: AnalysisRun['hypotheses'][number]): string {
  return (
    `[${hypothesis.id}] "${hypothesis.title}" -- confidence ${hypothesis.confidence}/100, ` +
    `status: ${hypothesis.status}${hypothesis.status === 'confirmed-by-human' ? ' (HUMAN-CONFIRMED)' : ''}`
  );
}

function buildUserPrompt(incident: Incident, run: AnalysisRun): string {
  const leading = findLeadingHypothesis(run);

  return [
    `Title: ${incident.title}`,
    `Severity: ${incident.severity}`,
    `Affected service: ${incident.affectedService}`,
    `Status: ${incident.status}`,
    `Started at: ${incident.startedAt ?? 'unknown'}`,
    `Detected at: ${incident.detectedAt}`,
    `Resolved at: ${incident.resolvedAt ?? 'not yet resolved'}`,
    '',
    'Description:',
    incident.description,
    '',
    `Evidence (${incident.evidence.length} item(s)):`,
    formatEvidenceForPrompt(incident.evidence),
    '',
    `Analysis summary: ${run.summary.text}`,
    `Impact: ${run.summary.impact}`,
    '',
    `Hypotheses investigated (${run.hypotheses.length}), leading is [${leading.id}]:`,
    run.hypotheses.map(formatHypothesisForPrompt).join('\n'),
    '',
    'Recommended actions from this analysis:',
    run.recommendedActions.map((action) => `- ${action.title}: ${action.expectedOutcome}`).join('\n') ||
      '(none)',
    '',
    'Reasoning risks flagged about this analysis:',
    run.reasoningRisks.map((risk) => `- ${risk.title}: ${risk.mitigation}`).join('\n') || '(none)',
    '',
    'Open questions:',
    run.openQuestions.map((q) => `- ${q}`).join('\n') || '(none)',
  ].join('\n');
}
