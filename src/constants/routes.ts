/**
 * Centralized route path constants, used by the router and by navigation
 * components so path strings are never duplicated across the app.
 */
export const ROUTES = {
  dashboard: '/',
  newIncident: '/incidents/new',
  incidentWorkspace: '/incidents/:incidentId',
} as const;

/**
 * Builds the concrete workspace URL for a given incident.
 *
 * @param incidentId Identifier of the incident to open.
 * @returns The path to that incident's workspace page.
 */
export function buildIncidentWorkspacePath(incidentId: string): string {
  return `/incidents/${incidentId}`;
}
