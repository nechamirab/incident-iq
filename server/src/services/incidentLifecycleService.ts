import type { Incident, IncidentStatus } from '../../../shared/types/incident.js';
import type { IncidentRepository } from '../repositories/IncidentRepository.js';
import type { IncidentStatusUpdateRequest } from '../schemas/incidentStatusUpdate.schema.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Computes the `resolvedAt` value an incident should carry after a status
 * transition, per the project's resolution lifecycle rules:
 *
 * - Moving to `"resolved"` sets `resolvedAt` to the caller-supplied
 *   timestamp (the resolution dialog always provides one; a fresh
 *   server-side timestamp is only a defensive fallback).
 * - Moving to `"archived"` preserves whatever `resolvedAt` already was --
 *   `null` if the incident was never resolved (archiving must never invent
 *   a resolution time), or the original resolution time if it was.
 * - Moving to any other status (`"draft"`, `"under-investigation"`, i.e.
 *   reopening) clears `resolvedAt` back to `null`.
 *
 * Pure and exported on its own so the transition rules can be unit-tested
 * directly, independent of the repository and HTTP layers.
 *
 * @param incident The incident's current state, before this update.
 * @param newStatus The status being transitioned to.
 * @param requestedResolvedAt The `resolvedAt` supplied on the request, if any.
 * @returns The `resolvedAt` value to persist.
 */
export function computeResolvedAt(
  incident: Incident,
  newStatus: IncidentStatus,
  requestedResolvedAt: string | undefined,
): string | null {
  if (newStatus === 'resolved') {
    return requestedResolvedAt ?? new Date().toISOString();
  }
  if (newStatus === 'archived') {
    return incident.resolvedAt;
  }
  return null;
}

/**
 * Updates an incident's lifecycle status, applying the resolution rules
 * above. `resolutionNotes` is only overwritten when the request explicitly
 * supplies it (even as an empty string) -- when omitted, e.g. on a reopen
 * that doesn't touch notes, the incident's existing notes are preserved
 * rather than silently cleared.
 *
 * @param repository The incident repository to read/update through.
 * @param incidentId The incident to update.
 * @param request The validated status-update request body.
 * @returns The updated incident.
 * @throws {ApiError} 404 if no incident exists with the given id.
 */
export async function updateIncidentStatus(
  repository: IncidentRepository,
  incidentId: string,
  request: IncidentStatusUpdateRequest,
): Promise<Incident> {
  const incident = await repository.findById(incidentId);
  if (!incident) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
  }

  const resolvedAt = computeResolvedAt(incident, request.status, request.resolvedAt);
  const resolutionNotes =
    request.resolutionNotes !== undefined ? request.resolutionNotes : incident.resolutionNotes;

  const updated = await repository.update(incidentId, {
    status: request.status,
    resolvedAt,
    resolutionNotes,
  });

  if (!updated) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', `No incident found with id "${incidentId}".`);
  }

  return updated;
}
