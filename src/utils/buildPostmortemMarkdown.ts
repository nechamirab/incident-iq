import type { Incident } from '../../shared/types/incident';
import type { Postmortem } from '../../shared/types/postmortem';

function formatList(items: readonly string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '_None recorded._';
}

/**
 * Renders a postmortem as a standalone Markdown document -- everything a
 * reader needs (incident metadata plus every postmortem field) without
 * requiring access to the IncidentIQ app itself. Pure and independent of
 * any UI, so it can be unit-tested directly and reused by both the "copy as
 * Markdown" and "download as Markdown" export actions.
 */
export function buildPostmortemMarkdown(incident: Incident, postmortem: Postmortem): string {
  return [
    `# Postmortem: ${incident.title}`,
    '',
    `**Severity:** ${incident.severity} &middot; **Status:** ${incident.status} &middot; ` +
      `**Affected service:** ${incident.affectedService}`,
    `**Detected:** ${incident.detectedAt} &middot; **Resolved:** ${incident.resolvedAt ?? 'Not yet resolved'}`,
    '',
    '## Incident Summary',
    '',
    postmortem.incidentSummary,
    '',
    '## Impact',
    '',
    postmortem.impact,
    '',
    '## Detection',
    '',
    postmortem.detection,
    '',
    '## Timeline',
    '',
    postmortem.timeline,
    '',
    '## Contributing Factors',
    '',
    formatList(postmortem.contributingFactors),
    '',
    '## Hypotheses Investigated',
    '',
    formatList(postmortem.hypothesesInvestigated),
    '',
    '## Likely Cause',
    '',
    postmortem.likelyCause,
    '',
    '## Uncertainty',
    '',
    postmortem.uncertaintyStatement,
    '',
    '## Resolution',
    '',
    postmortem.resolution,
    '',
    '## Corrective Actions',
    '',
    formatList(postmortem.correctiveActions),
    '',
    '## Lessons Learned',
    '',
    formatList(postmortem.lessonsLearned),
    '',
    '## Follow-up Items',
    '',
    formatList(postmortem.followUpItems),
    '',
    '---',
    '',
    `*Drafted by ${postmortem.provider ?? 'unknown'}/${postmortem.model ?? 'unknown'} ` +
      `(${postmortem.promptVersion ?? 'unknown'}) on ${postmortem.generatedAt ?? 'unknown'}. ` +
      `Last edited: ${postmortem.lastEditedAt ?? 'never'}.*`,
  ].join('\n');
}
