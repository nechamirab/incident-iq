import type { Incident } from '../../shared/types/incident';
import { EVIDENCE_TEXT_FIELDS } from '../../shared/constants/evidenceFields';
import type { NewIncidentFormValues } from '../schemas/newIncidentForm.schema';
import { apiRequest } from './apiClient';

/**
 * Fetches every incident (bundled samples plus any created by the user).
 */
export async function fetchIncidents(): Promise<Incident[]> {
  return apiRequest<Incident[]>('/api/incidents');
}

/**
 * Fetches a single incident by id.
 */
export async function fetchIncidentById(incidentId: string): Promise<Incident> {
  return apiRequest<Incident>(`/api/incidents/${incidentId}`);
}

/**
 * Converts a native `datetime-local` value (`YYYY-MM-DDTHH:mm`, no
 * timezone) into a full ISO-8601 UTC timestamp the backend accepts.
 */
function toIsoString(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

/**
 * Submits the New Incident form: builds a `multipart/form-data` request
 * from the validated form values and any attached files, and creates the
 * incident (with its extracted evidence) on the backend.
 *
 * @param values The validated New Incident form values.
 * @param files Files the user attached, already client-validated.
 * @returns The newly created incident, including its extracted evidence.
 */
export async function createIncident(
  values: NewIncidentFormValues,
  files: File[],
): Promise<Incident> {
  const formData = new FormData();

  formData.set('title', values.title);
  formData.set('description', values.description);
  formData.set('severity', values.severity);
  formData.set('affectedService', values.affectedService);
  formData.set('detectedAt', toIsoString(values.detectedAt));
  formData.set('scenarioType', values.scenarioType);

  if (values.startedAt) {
    formData.set('startedAt', toIsoString(values.startedAt));
  }

  for (const { field } of EVIDENCE_TEXT_FIELDS) {
    const value = values[field];
    if (value) {
      formData.set(field, value);
    }
  }

  for (const file of files) {
    formData.append('files', file);
  }

  return apiRequest<Incident>('/api/incidents', { method: 'POST', body: formData });
}
