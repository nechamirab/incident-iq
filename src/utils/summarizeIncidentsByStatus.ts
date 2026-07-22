import type { Incident, IncidentStatus } from '../../shared/types/incident';

export interface IncidentStatusCount {
  status: IncidentStatus;
  count: number;
}

/** Fixed lifecycle display order, matching `IncidentStatusSchema`. */
const STATUS_ORDER: readonly IncidentStatus[] = [
  'draft',
  'analyzing',
  'under-investigation',
  'resolved',
  'archived',
];

/**
 * Counts incidents per status, in a fixed lifecycle order and including
 * statuses with zero incidents, so the Dashboard's summary row never
 * reflows as counts change.
 */
export function summarizeIncidentsByStatus(incidents: readonly Incident[]): IncidentStatusCount[] {
  const counts = new Map<IncidentStatus, number>(STATUS_ORDER.map((status) => [status, 0]));

  for (const incident of incidents) {
    counts.set(incident.status, (counts.get(incident.status) ?? 0) + 1);
  }

  return STATUS_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}
