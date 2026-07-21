/**
 * Centralized TanStack Query key factory, so cache keys are never
 * hand-written (and risk drifting) at each call site.
 */
export const queryKeys = {
  health: ['health'] as const,
  incidents: ['incidents'] as const,
  incident: (incidentId: string) => ['incidents', incidentId] as const,
  sampleIncidents: ['incidents', 'samples'] as const,
};
