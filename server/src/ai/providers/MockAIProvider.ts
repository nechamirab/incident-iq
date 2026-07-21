import type { EvidenceItem, EvidenceSourceType } from '../../../../shared/types/evidence.js';
import type { Incident } from '../../../../shared/types/incident.js';
import type { ActionCategory, ActionPriority } from '../../../../shared/types/action.js';
import type { IncidentSeverity } from '../../../../shared/types/incident.js';
import type {
  AiAnalysisResponse,
  AiBiasFinding,
  AiHypothesis,
  AiRecommendedAction,
  AiReasoningItem,
  AiTimelineEvent,
} from '../schemas/aiAnalysisResponse.schema.js';
import type { AIPrompt, AIProvider } from './AIProvider.js';

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

function buildReasoningRisks(groups: Map<EvidenceSourceType, EvidenceItem[]>): AiBiasFinding[] {
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

  return risks;
}

function buildRecommendedActions(clusters: EvidenceCluster[], severity: IncidentSeverity): AiRecommendedAction[] {
  return clusters.map((cluster, index) => ({
    title: `Investigate ${humanize(cluster.sourceType)} evidence`,
    description: `Review the ${cluster.items.length} ${humanize(cluster.sourceType)} evidence item(s) for this incident in detail.`,
    priority: SEVERITY_TO_PRIORITY[severity],
    category: SOURCE_TYPE_TO_ACTION_CATEGORY[cluster.sourceType] ?? 'inspect',
    relatedHypothesisIds: [`H${index + 1}`],
    evidenceIds: cluster.items.map((item) => item.id),
    expectedOutcome: 'Confirms or rules out this evidence category as a contributing factor.',
    risk: 'Low; this is a read-only investigation step.',
  }));
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

  return {
    summary: {
      text: `Deterministic mock analysis of "${incident.title}" based on ${incident.evidence.length} evidence item(s) affecting ${incident.affectedService}.`,
      affectedComponents: [incident.affectedService],
      impact: `Severity was classified as ${incident.severity}. Actual user/business impact should be confirmed against the evidence.`,
    },
    timeline: buildTimeline(incident.evidence),
    facts: buildFacts(groups),
    assumptions: buildAssumptions(groups),
    hypotheses: buildHypotheses(clusters, descriptionItem),
    reasoningRisks: buildReasoningRisks(groups),
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
 * Deterministic, offline AI provider used when `AI_PROVIDER=mock` (the
 * default). Never makes a network call and never pretends its output came
 * from a real model -- `name`/`model` always identify it as the mock.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock-deterministic-v1';

  async complete(incident: Incident, _prompt: AIPrompt): Promise<string> {
    return JSON.stringify(buildMockAnalysis(incident));
  }
}
