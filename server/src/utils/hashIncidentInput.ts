import { createHash } from 'node:crypto';
import type { Incident } from '../../../shared/types/incident.js';

/**
 * Computes a stable hash of the exact incident content (metadata plus
 * every evidence item's id and normalized content) that was sent to the AI
 * provider for one analysis run. Recorded as `AnalysisRun.inputHash`, so a
 * later run against unchanged evidence is recognizably "the same input",
 * and a run can be audited against the evidence set that actually
 * produced it.
 *
 * @param incident The incident as it existed when analysis started.
 * @returns A hex-encoded SHA-256 hash.
 */
export function hashIncidentInput(incident: Incident): string {
  const canonical = JSON.stringify({
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    affectedService: incident.affectedService,
    startedAt: incident.startedAt,
    detectedAt: incident.detectedAt,
    evidence: incident.evidence
      .map((item) => ({ id: item.id, sourceType: item.sourceType, content: item.normalizedContent }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });

  return createHash('sha256').update(canonical).digest('hex');
}
