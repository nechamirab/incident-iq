import type { Incident } from '../../shared/types/incident';
import type { UpdateIncidentStatusPayload } from '../services/incidentService';

/**
 * Computes what an incident should look like immediately after a status
 * update, before the server has actually responded -- used to drive the
 * optimistic cache update in {@link useUpdateIncidentStatus}. Mirrors the
 * backend's `computeResolvedAt` transition rules (see
 * `server/src/services/incidentLifecycleService.ts`) so the optimistic
 * value matches what the server will actually persist in the common case:
 * resolving sets `resolvedAt`, archiving preserves whatever it already was,
 * and any other transition (reopening) clears it. `resolutionNotes` is only
 * overwritten when the payload explicitly supplies it.
 *
 * Pure and independent of TanStack Query so it can be unit-tested directly.
 *
 * @param incident The incident currently in cache.
 * @param payload The status-update request about to be sent.
 * @returns The optimistically-updated incident.
 */
export function applyOptimisticStatusUpdate(
  incident: Incident,
  payload: UpdateIncidentStatusPayload,
): Incident {
  let resolvedAt: string | null;
  if (payload.status === 'resolved') {
    resolvedAt = payload.resolvedAt ?? new Date().toISOString();
  } else if (payload.status === 'archived') {
    resolvedAt = incident.resolvedAt;
  } else {
    resolvedAt = null;
  }

  const resolutionNotes =
    payload.resolutionNotes !== undefined ? payload.resolutionNotes : incident.resolutionNotes;

  return {
    ...incident,
    status: payload.status,
    resolvedAt,
    resolutionNotes,
    updatedAt: new Date().toISOString(),
  };
}
