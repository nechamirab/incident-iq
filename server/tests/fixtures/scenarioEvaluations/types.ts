import type { BiasType } from '../../../../shared/types/bias.js';

/**
 * Development-only evaluation metadata describing what a *responsible*
 * analysis of a sample incident should look like -- never a single
 * hardcoded "correct AI answer". This is deliberately kept separate from
 * `server/src/data/incidents/`: nothing here is part of the `Incident`
 * domain model, nothing here is ever sent to an AI provider as evidence or
 * prompt content, and nothing here is imported by any production code path
 * (`server/src/**`). It exists purely so automated tests and manual
 * evaluation have a concrete, evidence-referenced yardstick to compare real
 * (mock, Anthropic, or OpenAI) AI output against -- facts it should find,
 * assumptions it must not present as settled, hypotheses it should
 * consider, evidence that should complicate an overconfident conclusion,
 * and reasoning risks the scenario was designed to surface.
 */
export interface ScenarioHypothesisFixture {
  /** Short, human-readable id for this hypothesis within the fixture (not a domain id). */
  id: string;
  /** One-sentence statement of the candidate root cause. */
  summary: string;
  /** Evidence ids (from the matching `Incident.evidence`) that support this hypothesis. */
  supportingEvidenceIds: string[];
  /** Evidence ids that should give a careful investigator pause about this specific hypothesis. */
  contradictingEvidenceIds: string[];
}

export interface ScenarioEvaluationFixture {
  /** The `Incident.id` this fixture describes. */
  incidentId: string;
  /**
   * Statements directly supported by the cited evidence -- what a
   * responsible analysis should be willing to call a "fact" rather than an
   * "assumption". Every entry must cite at least one real evidence id.
   */
  expectedFacts: Array<{ statement: string; evidenceIds: string[] }>;
  /**
   * Plausible-sounding claims that this scenario's evidence does *not*
   * actually establish -- legitimate candidate explanations or unconfirmed
   * claims that a responsible analysis must present as an assumption or
   * hypothesis, never as a settled fact.
   */
  mustNotBePresentedAsFacts: string[];
  /** More than one non-exclusive, plausible root-cause hypothesis this scenario was built to support. */
  plausibleHypotheses: ScenarioHypothesisFixture[];
  /**
   * Evidence ids that should specifically challenge/weaken the single
   * most-obvious ("leading") hypothesis an investigator might jump to --
   * what a skeptic review of this incident ought to raise.
   */
  challengingEvidenceIdsForLeadingExplanation: string[];
  /** Reasoning risks (from `BiasType`) this scenario was deliberately designed to surface. */
  expectedReasoningRisks: BiasType[];
  /** Evidence ids that are deliberately irrelevant or distracting -- not causally connected to the incident. */
  distractingEvidenceIds: string[];
  /** Evidence ids that describe a genuine gap in available information, not a finding. */
  missingInformationEvidenceIds: string[];
  /** Evidence ids with an approximate/inferred (not exact) timestamp -- i.e. `timestamp: null` in the incident data. */
  approximateOrInferredEvidenceIds: string[];
  /** Genuine open questions a thorough analysis of this incident should flag as unanswered. */
  openQuestions: string[];
}
