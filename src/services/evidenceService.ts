import type { Incident } from '../../shared/types/incident';
import type { EvidenceSourceType } from '../../shared/types/evidence';
import { apiRequest } from './apiClient';

/** Request payload for {@link addEvidenceItem}. */
export interface AddEvidenceItemPayload {
  sourceType: EvidenceSourceType;
  sourceName: string;
  content: string;
  /** Full ISO-8601 timestamp; omit when the evidence has no known exact time. */
  timestamp?: string;
}

/**
 * Adds a single, manually entered evidence item to an existing incident.
 *
 * @param incidentId The incident to add evidence to.
 * @param payload The new evidence item's fields.
 * @returns The updated incident, including the newly added evidence item.
 */
export async function addEvidenceItem(
  incidentId: string,
  payload: AddEvidenceItemPayload,
): Promise<Incident> {
  return apiRequest<Incident>(`/api/incidents/${incidentId}/evidence`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
