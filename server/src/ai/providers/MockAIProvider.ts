import type { AiProviderName, AnalysisRun } from '../../../../shared/types/analysisRun.js';
import type { EvidenceItem, EvidenceSourceType } from '../../../../shared/types/evidence.js';
import type { Incident } from '../../../../shared/types/incident.js';
import type { ActionCategory, ActionPriority } from '../../../../shared/types/action.js';
import type { IncidentSeverity } from '../../../../shared/types/incident.js';
import type { TimelineEvent } from '../../../../shared/types/timeline.js';
import type {
  AiAnalysisResponse,
  AiBiasFinding,
  AiHypothesis,
  AiRecommendedAction,
  AiReasoningItem,
  AiTimelineEvent,
} from '../schemas/aiAnalysisResponse.schema.js';
import type { AiSkepticReviewResponse } from '../schemas/skepticReviewResponse.schema.js';
import type { AiPostmortemResponse } from '../schemas/postmortemResponse.schema.js';
import { findLeadingHypothesis } from '../prompts/skepticReviewV1.js';
import type { AICompletionContext, AIPrompt, AIProvider } from './AIProvider.js';

const FACT_WORTHY_SOURCE_TYPES: readonly EvidenceSourceType[] = [
  'application-log',
  'error-trace',
  'monitoring-alert',
  'api-error',
  'database-error',
];

const ASSUMPTION_SOURCE_TYPES: readonly EvidenceSourceType[] = [
  'deployment-note',
  'user-report',
  'support-message',
  'other',
  'uploaded-file',
];

const CLUSTER_SOURCE_TYPES: readonly EvidenceSourceType[] = [
  ...FACT_WORTHY_SOURCE_TYPES,
  'deployment-note',
];

const SOURCE_TYPE_TO_ACTION_CATEGORY: Partial<Record<EvidenceSourceType, ActionCategory>> = {
  'application-log': 'inspect',
  'error-trace': 'inspect',
  'database-error': 'database-check',
  'deployment-note': 'configuration-check',
  'monitoring-alert': 'monitor',
  'api-error': 'reproduce',
  'user-report': 'communicate',
  'support-message': 'communicate',
};

const SEVERITY_TO_PRIORITY: Record<IncidentSeverity, ActionPriority> = {
  critical: 'immediate',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

/** Below this many total evidence items, a "base-rate neglect" risk is flagged. */
const SPARSE_EVIDENCE_THRESHOLD = 5;
/** At/above this fraction of evidence from one source type, "availability bias" is flagged. */
const DOMINANT_SOURCE_FRACTION = 0.5;

function humanize(sourceType: EvidenceSourceType): string {
  return sourceType.replace(/-/g, ' ');
}

function groupBySourceType(evidence: readonly EvidenceItem[]): Map<EvidenceSourceType, EvidenceItem[]> {
  const groups = new Map<EvidenceSourceType, EvidenceItem[]>();
  for (const item of evidence) {
    const list = groups.get(item.sourceType) ?? [];
    list.push(item);
    groups.set(item.sourceType, list);
  }
  return groups;
}

function hasTimestamp(item: EvidenceItem): item is EvidenceItem & { timestamp: string } {
  return item.timestamp !== null;
}

/**
 * Describes the time span covered by a set of evidence items, using their
 * raw ISO timestamps (never locale-formatted, so mock output stays
 * deterministic regardless of the runtime's locale/timezone).
 */
function describeTimeWindow(items: readonly EvidenceItem[]): string {
  const timestamps = items
    .map((item) => item.timestamp)
    .filter((value): value is string => value !== null)
    .sort();

  if (timestamps.length === 0) {
    return 'the evidence collected (no timestamps available)';
  }
  if (timestamps[0] === timestamps[timestamps.length - 1]) {
    return `around ${timestamps[0]}`;
  }
  return `between ${timestamps[0]} and ${timestamps[timestamps.length - 1]}`;
}

function buildFacts(groups: Map<EvidenceSourceType, EvidenceItem[]>): AiReasoningItem[] {
  const facts: AiReasoningItem[] = [];
  for (const sourceType of FACT_WORTHY_SOURCE_TYPES) {
    for (const item of (groups.get(sourceType) ?? []).slice(0, 3)) {
      facts.push({
        statement: `${item.sourceName} reported: ${item.normalizedContent}`,
        explanation: `Directly observed in evidence item ${item.id} (${humanize(item.sourceType)}).`,
        evidenceIds: [item.id],
        confidence: 80,
      });
    }
  }
  return facts;
}

function buildAssumptions(groups: Map<EvidenceSourceType, EvidenceItem[]>): AiReasoningItem[] {
  const assumptions: AiReasoningItem[] = [];
  for (const sourceType of ASSUMPTION_SOURCE_TYPES) {
    for (const item of (groups.get(sourceType) ?? []).slice(0, 3)) {
      assumptions.push({
        statement: `It is possible that this is related to the incident: ${item.normalizedContent}`,
        explanation: `Based on ${humanize(item.sourceType)} evidence item ${item.id}; this has not been confirmed.`,
        evidenceIds: [item.id],
        confidence: 35,
      });
    }
  }
  return assumptions;
}

function buildTimeline(evidence: readonly EvidenceItem[]): AiTimelineEvent[] {
  return evidence
    .filter(hasTimestamp)
    .slice()
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))
    .map((item) => ({
      timestamp: item.timestamp,
      title: item.sourceName,
      description: item.normalizedContent,
      evidenceIds: [item.id],
      timestampType: 'exact' as const,
      confidence: 90,
      isInferred: false,
    }));
}

interface EvidenceCluster {
  sourceType: EvidenceSourceType;
  items: EvidenceItem[];
}

function buildClusters(groups: Map<EvidenceSourceType, EvidenceItem[]>): EvidenceCluster[] {
  return CLUSTER_SOURCE_TYPES.map((sourceType) => ({ sourceType, items: groups.get(sourceType) ?? [] }))
    .filter((cluster) => cluster.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, 4);
}

function buildHypotheses(clusters: EvidenceCluster[], descriptionItem: EvidenceItem | undefined): AiHypothesis[] {
  const hypotheses: AiHypothesis[] = clusters.map((cluster, index) => ({
    tempId: `H${index + 1}`,
    title: `Possible cause related to ${humanize(cluster.sourceType)}`,
    description:
      `The ${cluster.items.length} ${humanize(cluster.sourceType)} evidence item(s) attached to this ` +
      'incident may indicate a contributing factor. This has not been independently confirmed.',
    confidence: Math.min(85, 25 + cluster.items.length * 15),
    confidenceReason:
      `Based on ${cluster.items.length} related evidence item(s) of this type. Confidence is limited ` +
      'because this is a deterministic mock analysis, not a full investigation.',
    supportingEvidenceIds: cluster.items.map((item) => item.id),
    contradictingEvidenceIds: [],
    assumptions: ['No independent verification has been performed by this mock provider.'],
    recommendedTest: `Review the ${cluster.items.length} ${humanize(cluster.sourceType)} evidence item(s) referenced above to confirm or rule out this explanation.`,
    expectedResult: 'Confirmation or refutation of this hypothesis based on further investigation.',
  }));

  while (hypotheses.length < 3) {
    const index = hypotheses.length;
    hypotheses.push({
      tempId: `H${index + 1}`,
      title: 'Insufficient evidence to isolate a specific cause',
      description:
        'The evidence currently attached to this incident does not clearly point to a single root cause.',
      confidence: 15,
      confidenceReason: 'Very limited evidence is available for this incident.',
      supportingEvidenceIds: descriptionItem ? [descriptionItem.id] : [],
      contradictingEvidenceIds: [],
      assumptions: [],
      recommendedTest: 'Collect additional logs, monitoring data, or user reports related to this incident.',
      expectedResult: 'Additional evidence to support or refute a more specific hypothesis.',
    });
  }

  return hypotheses;
}

/**
 * Detects reasoning risks relevant to *this* analysis, rather than listing
 * every known bias unconditionally. Each heuristic is a genuine, generic
 * check against the incident's actual evidence/hypotheses (not hand-tuned
 * to any specific sample incident), but in practice at least three of them
 * fire for almost any real analysis: `automation-bias` always applies to
 * this mock provider, `confirmation-bias` applies whenever a hypothesis
 * lacks contradicting evidence (this mock never generates any, and even a
 * real model often struggles to), and `base-rate-neglect` applies to any
 * evidence-sparse incident -- together covering both richly- and
 * sparsely-evidenced incidents.
 */
function buildReasoningRisks(
  incident: Incident,
  groups: Map<EvidenceSourceType, EvidenceItem[]>,
  hypotheses: readonly AiHypothesis[],
): AiBiasFinding[] {
  const risks: AiBiasFinding[] = [
    {
      biasType: 'automation-bias',
      title: 'Mock analysis has not been reviewed',
      description:
        'This analysis was produced by a deterministic mock AI provider for local development and ' +
        'testing, not a real reasoning model.',
      detectedIn: 'overall-analysis',
      evidenceIds: [],
      riskLevel: 'medium',
      mitigation:
        'Treat this output as a structural placeholder. Set AI_PROVIDER=anthropic for real analysis, ' +
        'and always have a human review any AI-generated hypothesis before acting on it.',
    },
  ];

  const deploymentEvidence = groups.get('deployment-note') ?? [];
  if (deploymentEvidence.length > 0) {
    risks.push({
      biasType: 'post-hoc-fallacy',
      title: 'Deployment timing does not establish causation',
      description:
        'A deployment or configuration change is present in the evidence for this incident. Timing ' +
        'alone does not confirm that it caused the incident.',
      detectedIn: 'hypotheses',
      evidenceIds: deploymentEvidence.map((item) => item.id),
      riskLevel: 'medium',
      mitigation:
        'Look for a concrete causal mechanism (a specific config value, code change, or resource ' +
        'exhaustion), not just temporal proximity.',
    });
  }

  const unrebuttedHypotheses = hypotheses.filter((h) => h.contradictingEvidenceIds.length === 0);
  if (unrebuttedHypotheses.length > 0) {
    risks.push({
      biasType: 'confirmation-bias',
      title: 'No contradicting evidence has been identified',
      description:
        `${unrebuttedHypotheses.length} of ${hypotheses.length} hypothesis/hypotheses list no ` +
        'contradicting evidence. That may mean none exists, or it may mean disconfirming evidence was ' +
        'never actively sought.',
      detectedIn: 'hypotheses',
      evidenceIds: [],
      riskLevel: 'medium',
      mitigation:
        'For each hypothesis, deliberately search for evidence that argues against it, not only for it.',
    });
  }

  if (incident.evidence.length < SPARSE_EVIDENCE_THRESHOLD) {
    risks.push({
      biasType: 'base-rate-neglect',
      title: 'Analysis is based on very little evidence',
      description:
        `Only ${incident.evidence.length} evidence item(s) are attached to this incident. Conclusions ` +
        'drawn from a small sample can overstate how representative they are of the true cause.',
      detectedIn: 'overall-analysis',
      evidenceIds: [],
      riskLevel: 'low',
      mitigation:
        'Collect additional logs, monitoring data, or user reports before treating any hypothesis as likely.',
    });
  }

  if (incident.startedAt) {
    const startedAt = incident.startedAt;
    const earlyEvidence = incident.evidence.filter(
      (item) => item.timestamp !== null && item.timestamp < startedAt,
    );
    if (earlyEvidence.length > 0) {
      risks.push({
        biasType: 'anchoring-bias',
        title: 'Evidence predating the incident may anchor the investigation',
        description:
          `${earlyEvidence.length} evidence item(s) are timestamped before the incident's recorded ` +
          `start time (${startedAt}). Early evidence can disproportionately anchor an investigation ` +
          'even when it later turns out to be unrelated.',
        detectedIn: 'timeline',
        evidenceIds: earlyEvidence.map((item) => item.id),
        riskLevel: 'medium',
        mitigation:
          'Explicitly test whether this earlier evidence is causally connected to the incident, or ' +
          'whether it is a coincidental, unrelated signal.',
      });
    }
  }

  const [dominantSourceType, dominantItems] =
    [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (
    dominantSourceType &&
    dominantItems &&
    incident.evidence.length >= SPARSE_EVIDENCE_THRESHOLD - 1 &&
    dominantItems.length / incident.evidence.length > DOMINANT_SOURCE_FRACTION
  ) {
    risks.push({
      biasType: 'availability-bias',
      title: `Evidence is dominated by a single source (${humanize(dominantSourceType)})`,
      description:
        `${dominantItems.length} of ${incident.evidence.length} evidence item(s) -- over half -- come ` +
        `from ${humanize(dominantSourceType)} alone. The most readily available evidence type may not ` +
        'represent the full picture.',
      detectedIn: 'evidence',
      evidenceIds: dominantItems.map((item) => item.id),
      riskLevel: 'low',
      mitigation:
        'Actively look for evidence from other sources (logs, monitoring, user reports, deployment ' +
        'history) before concluding.',
    });
  }

  return risks;
}

/**
 * Builds a category-specific, evidence-grounded action description that
 * names a concrete step (a metric, a time window, a comparison) rather
 * than generic advice like "investigate further" or "check the logs".
 */
function buildActionContent(
  category: ActionCategory,
  cluster: EvidenceCluster,
): { title: string; description: string; expectedOutcome: string } {
  const window = describeTimeWindow(cluster.items);
  const count = cluster.items.length;
  const sourceLabel = humanize(cluster.sourceType);

  switch (category) {
    case 'database-check':
      return {
        title: `Check database connection-pool and query metrics ${window}`,
        description:
          `Query connection-pool utilization and query latency for the window ${window}, covering the ` +
          `${count} ${sourceLabel} item(s) recorded here, to confirm whether resource exhaustion occurred.`,
        expectedOutcome: 'Confirms or rules out database resource exhaustion as a contributing factor.',
      };
    case 'configuration-check':
      return {
        title: `Diff the configuration/deployment change ${window}`,
        description:
          `Compare the configuration or deployment change(s) described in the ${count} ${sourceLabel} ` +
          `item(s) from ${window} against the prior known-good configuration to isolate the exact change.`,
        expectedOutcome: 'Identifies the specific configuration value or code change responsible, if any.',
      };
    case 'monitor':
      return {
        title: `Pull raw metric values behind the alert(s) ${window}`,
        description:
          `Retrieve the raw metric values behind the ${count} ${sourceLabel} item(s) from ${window} to ` +
          'determine whether the anomaly was a sudden spike or a sustained shift.',
        expectedOutcome: 'Clarifies the shape and severity of the underlying metric anomaly.',
      };
    case 'reproduce':
      return {
        title: `Reproduce the failing request pattern ${window}`,
        description:
          `Attempt to reproduce the exact request pattern behind the ${count} ${sourceLabel} item(s) ` +
          `from ${window} against a staging environment to confirm whether the failure is deterministic.`,
        expectedOutcome: 'Confirms whether the failure can be reliably reproduced outside production.',
      };
    case 'communicate':
      return {
        title: `Follow up on the ${count} ${sourceLabel} report(s)`,
        description:
          `Contact the reporter(s) behind the ${count} ${sourceLabel} item(s) from ${window} to confirm ` +
          'exact reproduction steps, affected account(s), and client version(s).',
        expectedOutcome: 'First-hand detail that narrows down affected users and conditions.',
      };
    case 'inspect':
    default:
      return {
        title: `Inspect ${sourceLabel} entries ${window}`,
        description:
          `Inspect the ${count} ${sourceLabel} entries from ${window} for the exact error signature or ` +
          "stack trace, and check whether it correlates with any deployment or configuration change in " +
          "this incident's timeline.",
        expectedOutcome: 'Confirms or rules out this evidence category as a contributing factor.',
      };
  }
}

function buildRecommendedActions(clusters: EvidenceCluster[], severity: IncidentSeverity): AiRecommendedAction[] {
  return clusters.map((cluster, index) => {
    const category = SOURCE_TYPE_TO_ACTION_CATEGORY[cluster.sourceType] ?? 'inspect';
    const { title, description, expectedOutcome } = buildActionContent(category, cluster);

    return {
      title,
      description,
      priority: SEVERITY_TO_PRIORITY[severity],
      category,
      relatedHypothesisIds: [`H${index + 1}`],
      evidenceIds: cluster.items.map((item) => item.id),
      expectedOutcome,
      risk: 'Low; this is a read-only investigation step.',
    };
  });
}

/**
 * Builds a fully deterministic (pure function of the incident's evidence,
 * no randomness or wall-clock dependence) mock analysis. Works for any
 * incident, not only the three bundled samples: evidence is grouped by
 * source type into clusters, each cluster becomes a hypothesis (padded
 * with generic low-confidence hypotheses if fewer than three clusters
 * exist, since the schema requires at least three), and facts/assumptions/
 * timeline/reasoning-risks/recommended-actions are all derived the same
 * grounded way.
 */
function buildMockAnalysis(incident: Incident): AiAnalysisResponse {
  const groups = groupBySourceType(incident.evidence);
  const descriptionItem = incident.evidence.find((item) => item.sourceType === 'incident-description');
  const clusters = buildClusters(groups);
  const hypotheses = buildHypotheses(clusters, descriptionItem);

  return {
    summary: {
      text: `Deterministic mock analysis of "${incident.title}" based on ${incident.evidence.length} evidence item(s) affecting ${incident.affectedService}.`,
      affectedComponents: [incident.affectedService],
      impact: `Severity was classified as ${incident.severity}. Actual user/business impact should be confirmed against the evidence.`,
    },
    timeline: buildTimeline(incident.evidence),
    facts: buildFacts(groups),
    assumptions: buildAssumptions(groups),
    hypotheses,
    reasoningRisks: buildReasoningRisks(incident, groups, hypotheses),
    recommendedActions: buildRecommendedActions(clusters, incident.severity),
    openQuestions: [
      'Has this hypothesis set been reviewed by a human investigator?',
      'Is there additional evidence not yet captured in this incident record?',
    ],
    unsupportedClaims: [],
    uncertaintyStatement:
      `This is a deterministic mock analysis intended for local development and testing. It reflects ` +
      `only the ${incident.evidence.length} evidence item(s) attached to this incident and has not been ` +
      'produced or reviewed by a real reasoning model.',
  };
}

/**
 * Builds a fully deterministic (pure function of the incident's evidence and
 * the run being reviewed) mock skeptic review. Challenges the leading
 * hypothesis (highest confidence) by name, cross-references its supporting
 * evidence back to the incident to find whether it leans on one dominant
 * source type, and reframes the run's other hypotheses as alternatives
 * worth reconsidering -- generic logic that works for any incident/run, not
 * hand-tuned to any specific sample.
 */
function buildMockSkepticReview(incident: Incident, run: AnalysisRun): AiSkepticReviewResponse {
  const leading = findLeadingHypothesis(run);
  const otherHypotheses = run.hypotheses.filter((h) => h.id !== leading.id);

  const evidenceById = new Map(incident.evidence.map((item) => [item.id, item]));
  const supportingItems = leading.supportingEvidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is EvidenceItem => item !== undefined);

  const sourceTypeCounts = new Map<EvidenceSourceType, number>();
  for (const item of supportingItems) {
    sourceTypeCounts.set(item.sourceType, (sourceTypeCounts.get(item.sourceType) ?? 0) + 1);
  }
  const dominant = [...sourceTypeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const dominantLabel = dominant ? humanize(dominant[0]) : undefined;
  const dominantCount = dominant ? dominant[1] : 0;

  const challengeSummary = dominantLabel
    ? `The leading hypothesis ("${leading.title}", confidence ${leading.confidence}/100) is supported ` +
      `by ${supportingItems.length} evidence item(s), ${dominantCount} of which are ${dominantLabel} ` +
      'alone. A concentration of evidence from one source does not rule out a different cause that ' +
      'would produce similar symptoms.'
    : `The leading hypothesis ("${leading.title}", confidence ${leading.confidence}/100) is supported ` +
      `by ${supportingItems.length} evidence item(s). It has not been independently stress-tested ` +
      'against alternative explanations.';

  const alternativeExplanations =
    otherHypotheses.length > 0
      ? otherHypotheses.map(
          (h) => `"${h.title}" (confidence ${h.confidence}/100) was not prioritized but has not been ruled out.`,
        )
      : [
          'No alternative hypotheses were proposed in the original analysis; consider whether the ' +
            'evidence supports an explanation outside this set entirely.',
        ];

  const confirmationBiasAssessment =
    leading.contradictingEvidenceIds.length === 0
      ? 'The leading hypothesis lists no contradicting evidence. Confirm this reflects a genuine ' +
        'absence of counter-evidence, not that disconfirming evidence was never sought.'
      : `The leading hypothesis does list ${leading.contradictingEvidenceIds.length} contradicting ` +
        'evidence item(s); confirm these were weighed fairly rather than discounted.';

  const falsificationTest = dominantLabel
    ? `Check whether ${dominantLabel} patterns like these also occur during known-healthy periods ` +
      'with no reported incident. If so, this hypothesis is falsified.'
    : `Identify a condition that, if observed, would be inconsistent with "${leading.title}" -- none ` +
      'is stated in the original analysis.';

  const recommendedTests = [
    `Independently verify the ${supportingItems.length} evidence item(s) behind the leading ` +
      'hypothesis without assuming the conclusion.',
    ...(otherHypotheses.length > 0
      ? [
          `Rule out or confirm the next-highest-confidence alternative ("${otherHypotheses[0].title}") ` +
            'before treating the leading hypothesis as likely.',
        ]
      : []),
  ];

  const overallAssessment =
    `This review does not confirm or reject "${leading.title}"; it highlights specific gaps -- ` +
    'concentrated evidence, unexamined alternatives, and an unconfirmed absence of contradicting ' +
    'evidence -- that a human investigator should close before treating it as likely.';

  return {
    challengeSummary,
    alternativeExplanations,
    confirmationBiasAssessment,
    falsificationTest,
    recommendedTests,
    overallAssessment,
  };
}

/** Describes the time span a run's timeline covers, using raw ISO timestamps for determinism. */
function describeTimelineWindow(events: readonly TimelineEvent[]): string {
  if (events.length === 0) {
    return 'No timestamped events were reconstructed from the available evidence.';
  }
  const timestamps = events.map((event) => event.timestamp).sort();
  if (timestamps[0] === timestamps[timestamps.length - 1]) {
    return `${events.length} event(s) were reconstructed, all around ${timestamps[0]}.`;
  }
  return (
    `${events.length} event(s) were reconstructed, spanning from ${timestamps[0]} to ` +
    `${timestamps[timestamps.length - 1]}.`
  );
}

/**
 * Builds a fully deterministic (pure function of the incident's evidence and
 * the run being summarized) mock postmortem draft. Every field is derived
 * from the run's own data -- confidence scores, reasoning risks, recommended
 * actions, open questions -- rather than generic boilerplate, so it works
 * for any incident/run, not just the bundled samples.
 */
function buildMockPostmortem(incident: Incident, run: AnalysisRun): AiPostmortemResponse {
  const leading = findLeadingHypothesis(run);
  const groups = groupBySourceType(incident.evidence);
  const dominant = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];

  const detection = dominant
    ? `Detected at ${incident.detectedAt}, primarily via ${humanize(dominant[0])} ` +
      `(${dominant[1].length} of ${incident.evidence.length} evidence item(s)).`
    : `Detected at ${incident.detectedAt}, based on ${incident.evidence.length} evidence item(s) ` +
      'submitted for this incident.';

  const contributingThreshold = Math.max(0, leading.confidence - 20);
  const contributingFactors = run.hypotheses
    .filter((hypothesis) => hypothesis.confidence >= contributingThreshold)
    .sort((a, b) => b.confidence - a.confidence)
    .map((hypothesis) => `${hypothesis.title} (confidence ${hypothesis.confidence}/100)`);

  const hypothesesInvestigated = run.hypotheses.map(
    (hypothesis) => `${hypothesis.title} -- confidence ${hypothesis.confidence}/100, status: ${hypothesis.status}`,
  );

  const likelyCause =
    leading.status === 'confirmed-by-human'
      ? `The confirmed cause is: ${leading.title} -- ${leading.description} This was confirmed by ` +
        'a human reviewer.'
      : `The available evidence suggests the most likely explanation is: ${leading.title} ` +
        `(confidence ${leading.confidence}/100) -- ${leading.description}`;

  const resolution =
    incident.status === 'resolved' && incident.resolvedAt
      ? `This incident was marked resolved at ${incident.resolvedAt}.`
      : `This incident has not yet been marked resolved (current status: ${incident.status}). ` +
        'Resolution details should be added once the incident is closed.';

  const correctiveActions =
    run.recommendedActions.length > 0
      ? run.recommendedActions.map((action) => `${action.title}: ${action.expectedOutcome}`)
      : ['No recommended actions were generated by the analysis; add corrective actions manually.'];

  const lessonsLearned =
    run.reasoningRisks.length > 0
      ? run.reasoningRisks.map((risk) => `${risk.title}: ${risk.mitigation}`)
      : ['No reasoning risks were flagged for this analysis.'];

  const followUpItems =
    run.openQuestions.length > 0
      ? run.openQuestions
      : ['No open questions were recorded for this analysis.'];

  return {
    incidentSummary: run.summary.text,
    impact: run.summary.impact,
    detection,
    timeline: describeTimelineWindow(run.timeline),
    contributingFactors,
    hypothesesInvestigated,
    likelyCause,
    uncertaintyStatement: run.uncertaintyStatement,
    resolution,
    correctiveActions,
    lessonsLearned,
    followUpItems,
  };
}

/** Supplied only when a `MockAIProvider` instance is standing in for a misconfigured `anthropic` setup. */
export interface MockFallbackInfo {
  configuredProvider: AiProviderName;
  reason: string;
}

/**
 * Deterministic, offline AI provider used when `AI_PROVIDER=mock` (the
 * default). Never makes a network call and never pretends its output came
 * from a real model -- `name`/`model` always identify it as the mock, even
 * when this instance is standing in for `anthropic` as an explicit fallback
 * (`createAIProvider` is the only caller that ever passes `fallbackInfo`;
 * nothing here decides to fall back on its own).
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock-deterministic-v1';
  readonly configuredProvider: AiProviderName;
  readonly fallbackUsed: boolean;
  readonly fallbackReason: string | null;
  /** Verification isn't a meaningful concept for a provider with no external API to reach. */
  readonly providerVerified = null;
  /** No external API is ever called, so there is no request id to report. */
  readonly providerRequestId = null;

  constructor(fallbackInfo?: MockFallbackInfo) {
    this.configuredProvider = fallbackInfo?.configuredProvider ?? 'mock';
    this.fallbackUsed = fallbackInfo !== undefined;
    this.fallbackReason = fallbackInfo?.reason ?? null;
  }

  async complete(incident: Incident, _prompt: AIPrompt, context?: AICompletionContext): Promise<string> {
    if (context?.kind === 'skeptic-review') {
      return JSON.stringify(buildMockSkepticReview(incident, context.analysisRun));
    }
    if (context?.kind === 'postmortem') {
      return JSON.stringify(buildMockPostmortem(incident, context.analysisRun));
    }
    return JSON.stringify(buildMockAnalysis(incident));
  }
}
