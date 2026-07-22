import type { AnalysisRun } from '../../../../shared/types/analysisRun.js';
import type { Hypothesis } from '../../../../shared/types/hypothesis.js';
import type { Incident } from '../../../../shared/types/incident.js';
import type { AIPrompt } from '../providers/AIProvider.js';
import { formatEvidenceForPrompt } from './incidentAnalysisV1.js';

/** Version identifier recorded on every {@link SkepticReview} this prompt produces. */
export const SKEPTIC_REVIEW_PROMPT_VERSION = 'skeptic-review-v1';

const RESPONSE_SHAPE_DESCRIPTION = `{
  "challengeSummary": string,
  "alternativeExplanations": string[],
  "confirmationBiasAssessment": string,
  "falsificationTest": string,
  "recommendedTests": string[],
  "overallAssessment": string
}`;

/**
 * Finds the leading hypothesis of a completed analysis run -- the one with
 * the highest confidence score, ties broken by list order. Every hypothesis
 * schema requires at least three entries, so a run always has one.
 */
export function findLeadingHypothesis(run: AnalysisRun): Hypothesis {
  return [...run.hypotheses].sort((a, b) => b.confidence - a.confidence)[0];
}

/**
 * Purpose: the skeptic-review prompt. Given an incident and one of its
 * completed analysis runs, asks the model to critically challenge that
 * run's leading hypothesis -- surface alternative explanations, assess
 * confirmation-bias risk, describe what would falsify it, and recommend
 * additional tests -- without simply restating the original analysis.
 *
 * The leading hypothesis and the full evidence list are supplied directly
 * in the prompt (never left for the model to (re)determine), and the model
 * is deliberately NOT asked to name which evidence was "ignored" or which
 * hypothesis is "leading": the backend computes both facts itself in
 * `mapSkepticReviewResponse`, so this prompt only needs the model's
 * qualitative critique. Expected output: JSON matching
 * `AiSkepticReviewResponseSchema` -- see {@link RESPONSE_SHAPE_DESCRIPTION}.
 */
export function buildSkepticReviewPrompt(incident: Incident, run: AnalysisRun): AIPrompt {
  const leading = findLeadingHypothesis(run);
  return {
    system: buildSystemPrompt(leading),
    user: buildUserPrompt(incident, run, leading),
  };
}

function buildSystemPrompt(leading: Hypothesis): string {
  return [
    'You are a skeptical second reviewer for IncidentIQ, an incident-investigation tool. Another ' +
      'AI pass already produced an analysis of this incident; your job is to critically challenge ' +
      `its leading hypothesis ("${leading.title}"), not to repeat or validate it.`,
    '',
    'Rules you must follow:',
    '- Challenge the leading hypothesis specifically. Do not simply restate its reasoning approvingly.',
    '- Search for alternative explanations the original analysis may have under-weighted, including ' +
      'other hypotheses it proposed but ranked lower.',
    '- Assess whether the leading hypothesis shows signs of confirmation bias (e.g. no contradicting ' +
      'evidence was sought, or supporting evidence all comes from one narrow source).',
    '- Explain what evidence would falsify the leading hypothesis -- a concrete observation that, if ' +
      'made, would prove it wrong.',
    '- Recommend additional, concrete tests beyond what the original hypothesis already proposed. ' +
      'Never give generic advice like "investigate further".',
    '- Use ONLY the evidence supplied in the user message. Never invent components, timestamps, or ' +
      'events not present in the evidence.',
    '- Never use language implying certainty. This is a critique highlighting gaps, not a verdict.',
    '- Do NOT output which evidence was ignored or restate the leading hypothesis\'s id -- the ' +
      'system already knows both and will attach them itself.',
    '',
    'Respond with ONLY a single JSON object matching this exact shape -- no markdown code fences, ' +
      'no commentary before or after it:',
    RESPONSE_SHAPE_DESCRIPTION,
  ].join('\n');
}

function formatHypothesisForPrompt(hypothesis: Hypothesis, isLeading: boolean): string {
  const label = isLeading ? 'LEADING HYPOTHESIS TO CHALLENGE' : 'other hypothesis';
  return [
    `[${hypothesis.id}] (${label}) "${hypothesis.title}" -- confidence ${hypothesis.confidence}/100`,
    `  Description: ${hypothesis.description}`,
    `  Confidence reason: ${hypothesis.confidenceReason}`,
    `  Supporting evidence: ${hypothesis.supportingEvidenceIds.join(', ') || '(none)'}`,
    `  Contradicting evidence: ${hypothesis.contradictingEvidenceIds.join(', ') || '(none)'}`,
  ].join('\n');
}

function buildUserPrompt(incident: Incident, run: AnalysisRun, leading: Hypothesis): string {
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
    '',
    `The original analysis (prompt version "${run.promptVersion}") proposed ${run.hypotheses.length} ` +
      'hypothesis/hypotheses:',
    run.hypotheses.map((h) => formatHypothesisForPrompt(h, h.id === leading.id)).join('\n\n'),
    '',
    `Challenge the leading hypothesis ("${leading.title}") as instructed above.`,
  ].join('\n');
}
