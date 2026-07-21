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

/**
 * Single source of truth mapping each free-form New Incident form field to
 * the evidence category its content should be tagged with. Used by the
 * backend to extract evidence from a submission, and by the frontend to
 * render the form and to reconstruct field values when prefilling from a
 * sample incident's existing evidence.
 */
export const EVIDENCE_TEXT_FIELDS: readonly EvidenceTextFieldConfig[] = [
  {
    field: 'applicationLogs',
    sourceType: 'application-log',
    label: 'Application logs',
    helperText: 'Paste relevant application log lines, one per line.',
  },
  {
    field: 'errorTraces',
    sourceType: 'error-trace',
    label: 'Error traces',
    helperText: 'Paste stack traces or error trace excerpts, one entry per line.',
  },
  {
    field: 'monitoringAlerts',
    sourceType: 'monitoring-alert',
    label: 'Monitoring alerts',
    helperText: 'Paste alert notifications from your monitoring tools, one per line.',
  },
  {
    field: 'deploymentNotes',
    sourceType: 'deployment-note',
    label: 'Deployment notes',
    helperText: 'Paste recent deployment or configuration-change notes, one per line.',
  },
  {
    field: 'userComplaints',
    sourceType: 'user-report',
    label: 'User complaints',
    helperText: 'Paste user-reported issues or support tickets, one per line.',
  },
  {
    field: 'apiErrors',
    sourceType: 'api-error',
    label: 'API errors',
    helperText: 'Paste API error responses, one per line.',
  },
  {
    field: 'databaseErrors',
    sourceType: 'database-error',
    label: 'Database errors',
    helperText: 'Paste database error messages, one per line.',
  },
] as const;
