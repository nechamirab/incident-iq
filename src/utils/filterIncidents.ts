import type { Incident, IncidentSeverity, IncidentStatus } from '../../shared/types/incident';

export const INCIDENT_STATUS_FILTER_ALL = 'all' as const;
export type IncidentStatusFilter = IncidentStatus | typeof INCIDENT_STATUS_FILTER_ALL;

export const INCIDENT_SEVERITY_FILTER_ALL = 'all' as const;
export type IncidentSeverityFilter = IncidentSeverity | typeof INCIDENT_SEVERITY_FILTER_ALL;

export interface IncidentFilterOptions {
  search: string;
  status: IncidentStatusFilter;
  severity: IncidentSeverityFilter;
}

/**
 * Filters incidents by free-text search (matched against the title,
 * affected service, and id, case-insensitively) and/or status/severity.
 * Pure and easily testable independent of any UI.
 */
export function filterIncidents(
  incidents: readonly Incident[],
  { search, status, severity }: IncidentFilterOptions,
): Incident[] {
  const normalizedSearch = search.trim().toLowerCase();

  return incidents.filter((incident) => {
    if (status !== INCIDENT_STATUS_FILTER_ALL && incident.status !== status) {
      return false;
    }
    if (severity !== INCIDENT_SEVERITY_FILTER_ALL && incident.severity !== severity) {
      return false;
    }
    if (normalizedSearch.length === 0) {
      return true;
    }
    return (
      incident.title.toLowerCase().includes(normalizedSearch) ||
      incident.affectedService.toLowerCase().includes(normalizedSearch) ||
      incident.id.toLowerCase().includes(normalizedSearch)
    );
  });
}
