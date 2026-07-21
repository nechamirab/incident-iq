import type { EvidenceSourceType } from '../types/evidence.js';

export interface EvidenceTextFieldConfig {
  /** Key of this field on the incident intake request body / form state. */
  field:
    | 'applicationLogs'
    | 'errorTraces'
    | 'monitoringAlerts'
    | 'deploymentNotes'
    | 'userComplaints'
    | 'apiErrors'
    | 'databaseErrors';
  sourceType: EvidenceSourceType;
  label: string;
  helperText: string;
}

const TIMESTAMP_HINT =
  ' Optionally start a line with [YYYY-MM-DDTHH:mm:ssZ] to record its exact time (used to place ' +
  "it on the incident's timeline).";

/**
 * Single source of truth mapping each free-form New Incident form field to
 * the evidence category its content should be tagged with. Used by the
 * backend to extract evidence from a submission, and by the frontend to
 * render the form and to reconstruct field values when prefilling from a
 * sample incident's existing evidence.
 *
 * The `[ISO-8601 timestamp]` line prefix convention referenced in each
 * `helperText` is recognized and stripped by
 * `server/src/parsers/textParser.ts`'s `parseTextContent` -- it's also how
 * `buildFormValuesFromIncident` (frontend) round-trips a sample incident's
 * evidence timestamps through the plain-text form fields when prefilling
 * from "Load sample incident".
 */
export const EVIDENCE_TEXT_FIELDS: readonly EvidenceTextFieldConfig[] = [
  {
    field: 'applicationLogs',
    sourceType: 'application-log',
    label: 'Application logs',
    helperText: `Paste relevant application log lines, one per line.${TIMESTAMP_HINT}`,
  },
  {
    field: 'errorTraces',
    sourceType: 'error-trace',
    label: 'Error traces',
    helperText: `Paste stack traces or error trace excerpts, one entry per line.${TIMESTAMP_HINT}`,
  },
  {
    field: 'monitoringAlerts',
    sourceType: 'monitoring-alert',
    label: 'Monitoring alerts',
    helperText: `Paste alert notifications from your monitoring tools, one per line.${TIMESTAMP_HINT}`,
  },
  {
    field: 'deploymentNotes',
    sourceType: 'deployment-note',
    label: 'Deployment notes',
    helperText: `Paste recent deployment or configuration-change notes, one per line.${TIMESTAMP_HINT}`,
  },
  {
    field: 'userComplaints',
    sourceType: 'user-report',
    label: 'User complaints',
    helperText: `Paste user-reported issues or support tickets, one per line.${TIMESTAMP_HINT}`,
  },
  {
    field: 'apiErrors',
    sourceType: 'api-error',
    label: 'API errors',
    helperText: `Paste API error responses, one per line.${TIMESTAMP_HINT}`,
  },
  {
    field: 'databaseErrors',
    sourceType: 'database-error',
    label: 'Database errors',
    helperText: `Paste database error messages, one per line.${TIMESTAMP_HINT}`,
  },
] as const;
