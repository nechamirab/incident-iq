import type { Incident } from '../../shared/types/incident';
import type { Postmortem } from '../../shared/types/postmortem';
import { apiRequest } from './apiClient';

/** A postmortem's content fields only -- never its system-managed provenance. */
export type PostmortemContent = Omit<
  Postmortem,
  'provider' | 'model' | 'promptVersion' | 'generatedAt' | 'lastEditedAt'
>;

/**
 * Generates (or regenerates, discarding any prior draft and edits) an AI
 * postmortem draft from an incident's most recent analysis run.
 *
 * @param incidentId The incident to draft a postmortem for.
 * @returns The updated incident, including its new postmortem.
 */
export async function generatePostmortem(incidentId: string): Promise<Incident> {
  return apiRequest<Incident>(`/api/incidents/${incidentId}/postmortem`, { method: 'POST' });
}

/**
 * Saves a human reviewer's edits to an existing postmortem draft.
 *
 * @param incidentId The incident whose postmortem should be edited.
 * @param patch The subset of content fields to update.
 * @returns The updated incident, including the edited postmortem.
 */
export async function editPostmortem(
  incidentId: string,
  patch: Partial<PostmortemContent>,
): Promise<Incident> {
  return apiRequest<Incident>(`/api/incidents/${incidentId}/postmortem`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
