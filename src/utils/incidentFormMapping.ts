import { EVIDENCE_TEXT_FIELDS } from '../../shared/constants/evidenceFields';
import type { Incident } from '../../shared/types/incident';
import type { NewIncidentFormValues } from '../schemas/newIncidentForm.schema';

/**
 * Converts a full ISO-8601 timestamp into the `YYYY-MM-DDTHH:mm` format a
 * native `datetime-local` input expects, rendered in the browser's local
 * time zone.
 *
 * @param iso An ISO-8601 timestamp.
 * @returns The equivalent `datetime-local` input value.
 */
export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Reconstructs New Incident form values from an existing incident's
 * metadata and evidence, so a bundled sample incident can be loaded into
 * the form as an editable starting point. Evidence items whose source type
 * has no corresponding form field (e.g. `uploaded-file`) are not
 * reconstructed -- files cannot be re-derived from stored evidence text.
 *
 * @param incident The incident to load into the form.
 * @returns Form values ready to pass to `reset()`.
 */
export function buildFormValuesFromIncident(incident: Incident): NewIncidentFormValues {
  const linesByField: Partial<Record<(typeof EVIDENCE_TEXT_FIELDS)[number]['field'], string[]>> =
    {};

  for (const item of incident.evidence) {
    const config = EVIDENCE_TEXT_FIELDS.find((candidate) => candidate.sourceType === item.sourceType);
    if (!config) {
      continue;
    }
    (linesByField[config.field] ??= []).push(item.originalContent);
  }

  return {
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    affectedService: incident.affectedService,
    startedAt: incident.startedAt ? toDatetimeLocalValue(incident.startedAt) : '',
    detectedAt: toDatetimeLocalValue(incident.detectedAt),
    scenarioType: incident.scenarioType,
    applicationLogs: (linesByField.applicationLogs ?? []).join('\n'),
    errorTraces: (linesByField.errorTraces ?? []).join('\n'),
    monitoringAlerts: (linesByField.monitoringAlerts ?? []).join('\n'),
    deploymentNotes: (linesByField.deploymentNotes ?? []).join('\n'),
    userComplaints: (linesByField.userComplaints ?? []).join('\n'),
    apiErrors: (linesByField.apiErrors ?? []).join('\n'),
    databaseErrors: (linesByField.databaseErrors ?? []).join('\n'),
  };
}
