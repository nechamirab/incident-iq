import type { AnalysisRunComparison } from './compareAnalysisRuns.js';
import type { PromptComparisonExperimentResult } from './promptComparisonExperiment.js';
import type { ProviderComparisonExperimentResult } from './providerComparisonExperiment.js';
import type { PromptSensitivityExperimentResult } from './promptSensitivityExperiment.js';
import type { SkepticReviewEvaluationResult } from './skepticReviewEvaluationExperiment.js';

function formatComparisonTable(labelA: string, labelB: string, c: AnalysisRunComparison): string {
  const rows: [string, string, string][] = [
    ['Leading hypothesis', c.leadingHypothesisTitleA, c.leadingHypothesisTitleB],
    ['Leading hypothesis confidence', `${c.leadingHypothesisConfidenceA}/100`, `${c.leadingHypothesisConfidenceB}/100`],
    ['Hypotheses with contradicting evidence', `${c.hypothesesWithContradictingEvidenceA}/${c.totalHypothesesA}`, `${c.hypothesesWithContradictingEvidenceB}/${c.totalHypothesesB}`],
    ['Reasoning risks identified', `${c.reasoningRiskCountA}`, `${c.reasoningRiskCountB}`],
    ['Recommended actions', `${c.recommendedActionCountA}`, `${c.recommendedActionCountB}`],
    ['Completeness warnings', `${c.completenessWarningsA.length}`, `${c.completenessWarningsB.length}`],
    ['Quality warnings', `${c.qualityWarningsA.length}`, `${c.qualityWarningsB.length}`],
  ];
  const lines = [
    `| Metric | ${labelA} | ${labelB} |`,
    '| --- | --- | --- |',
    ...rows.map(([label, a, b]) => `| ${label} | ${a} | ${b} |`),
  ];
  return lines.join('\n');
}

/** Pure Markdown formatter for Experiment A's result -- no filesystem access, directly unit-testable. */
export function formatPromptComparisonMarkdown(result: PromptComparisonExperimentResult): string {
  const lines: string[] = [
    '# Experiment A: Prompt Comparison (v1 vs. v2)',
    '',
    `Incident: \`${result.incidentId}\``,
    '',
    '## Mock pipeline check (always runs; not a real comparison)',
    '',
    result.mockPipelineCheck.note,
    '',
    `- v1 mock run: ${result.mockPipelineCheck.v1.run.hypotheses.length} hypotheses, ${result.mockPipelineCheck.v1.run.reasoningRisks.length} reasoning risks.`,
    `- v2 mock run: ${result.mockPipelineCheck.v2.run.hypotheses.length} hypotheses, ${result.mockPipelineCheck.v2.run.reasoningRisks.length} reasoning risks.`,
    '',
    '## Real-provider comparison',
    '',
  ];

  if (result.realComparison.status === 'not-run') {
    lines.push(`**NOT RUN.** ${result.realComparison.reason}`);
  } else {
    lines.push(
      `Provider: \`${result.realComparison.provider}\` (\`providerVerified\` confirmed by an actual successful call).`,
      '',
      formatComparisonTable('v1', 'v2', result.realComparison.comparison),
    );
  }

  return lines.join('\n') + '\n';
}

/** Pure Markdown formatter for Experiment B's result. */
export function formatProviderComparisonMarkdown(result: ProviderComparisonExperimentResult): string {
  const lines: string[] = [
    '# Experiment B: Provider Comparison (mock vs. real)',
    '',
    `Incident: \`${result.incidentId}\` -- prompt version \`${result.promptVersion}\``,
    '',
  ];

  for (const leg of result.realLegs) {
    lines.push(`## \`${leg.provider}\``, '');
    if (leg.status === 'not-run') {
      lines.push(`**NOT RUN.** ${leg.reason}`, '');
      continue;
    }
    const comparison = result.comparisons.find((c) => c.labelB === leg.provider);
    lines.push(`\`providerVerified\`: ${String(leg.metadata.providerVerified)}, duration: ${leg.metadata.durationMs}ms.`, '');
    if (comparison) {
      lines.push(formatComparisonTable('mock', leg.provider, comparison), '');
    }
  }

  if (result.realLegs.length === 0) {
    lines.push('No real providers were attempted for this run.');
  }

  return lines.join('\n') + '\n';
}

/** Pure Markdown formatter for Experiment C's result. */
export function formatPromptSensitivityMarkdown(result: PromptSensitivityExperimentResult): string {
  const lines: string[] = [
    '# Experiment C: Prompt Sensitivity (standard vs. "argue against first apparent cause")',
    '',
    `Incident: \`${result.incidentId}\``,
    '',
    '## Mock pipeline check (always runs; not a real comparison)',
    '',
    result.mockPipelineCheck.note,
    '',
    '## Real-provider comparison',
    '',
  ];

  if (result.realComparison.status === 'not-run') {
    lines.push(`**NOT RUN.** ${result.realComparison.reason}`);
  } else {
    lines.push(
      `Provider: \`${result.realComparison.provider}\`.`,
      '',
      formatComparisonTable('standard', 'argue-against-variant', result.realComparison.comparison),
    );
  }

  return lines.join('\n') + '\n';
}

/** Pure Markdown formatter for Experiment D's result. */
export function formatSkepticReviewMarkdown(result: SkepticReviewEvaluationResult): string {
  const lines: string[] = [
    '# Experiment D: Skeptic Review Evaluation (6 criteria)',
    '',
    `Incident: \`${result.incidentId}\``,
    '',
  ];

  if (result.reviewLeg.status === 'not-run') {
    lines.push(`**NOT RUN.** ${result.reviewLeg.reason}`);
    return lines.join('\n') + '\n';
  }

  lines.push(
    `Provider: \`${result.reviewLeg.provider}\`.`,
    '',
    '| Criterion | Passed | Detail |',
    '| --- | --- | --- |',
    ...result.reviewLeg.result.criteria.map(
      (c) => `| ${c.description} | ${c.passed ? 'YES' : 'NO'} | ${c.detail.replace(/\|/g, '\\|')} |`,
    ),
    '',
    `**Score: ${result.reviewLeg.result.criteria.filter((c) => c.passed).length} / ${result.reviewLeg.result.criteria.length}**`,
  );

  return lines.join('\n') + '\n';
}
