import type { ChipProps } from '@mui/material';
import type { HypothesisStatus } from '../../shared/types/hypothesis';
import type { IncidentSeverity, IncidentStatus } from '../../shared/types/incident';
import type { ReviewStatus } from '../../shared/types/reasoning';
import type { TimestampType } from '../../shared/types/timeline';

export interface StatusDisplay {
  label: string;
  color: NonNullable<ChipProps['color']>;
}

/**
 * Maps each severity/status/review-status value to a display label and a
 * theme-token chip color, so components never hardcode colors directly.
 * Text labels are always shown alongside color (never color alone), per
 * the app's accessibility requirements.
 */
const SEVERITY_DISPLAY: Record<IncidentSeverity, StatusDisplay> = {
  low: { label: 'Low', color: 'default' },
  medium: { label: 'Medium', color: 'info' },
  high: { label: 'High', color: 'warning' },
  critical: { label: 'Critical', color: 'error' },
};

const INCIDENT_STATUS_DISPLAY: Record<IncidentStatus, StatusDisplay> = {
  draft: { label: 'Draft', color: 'default' },
  analyzing: { label: 'Analyzing', color: 'info' },
  'under-investigation': { label: 'Under investigation', color: 'warning' },
  resolved: { label: 'Resolved', color: 'success' },
  archived: { label: 'Archived', color: 'default' },
};

const REVIEW_STATUS_DISPLAY: Record<ReviewStatus, StatusDisplay> = {
  unreviewed: { label: 'Unreviewed', color: 'default' },
  supported: { label: 'Supported', color: 'success' },
  'partially-supported': { label: 'Partially supported', color: 'warning' },
  unsupported: { label: 'Unsupported', color: 'error' },
  rejected: { label: 'Rejected', color: 'error' },
};

const HYPOTHESIS_STATUS_DISPLAY: Record<HypothesisStatus, StatusDisplay> = {
  proposed: { label: 'Proposed', color: 'default' },
  testing: { label: 'Testing', color: 'info' },
  supported: { label: 'Supported', color: 'success' },
  weakened: { label: 'Weakened', color: 'warning' },
  rejected: { label: 'Rejected', color: 'error' },
  'confirmed-by-human': { label: 'Confirmed by human', color: 'success' },
};

const TIMESTAMP_TYPE_DISPLAY: Record<TimestampType, StatusDisplay> = {
  exact: { label: 'Exact', color: 'success' },
  approximate: { label: 'Approximate', color: 'info' },
  inferred: { label: 'Inferred', color: 'warning' },
  unknown: { label: 'Unknown', color: 'default' },
};

export function getSeverityDisplay(severity: IncidentSeverity): StatusDisplay {
  return SEVERITY_DISPLAY[severity];
}

export function getIncidentStatusDisplay(status: IncidentStatus): StatusDisplay {
  return INCIDENT_STATUS_DISPLAY[status];
}

export function getReviewStatusDisplay(reviewStatus: ReviewStatus): StatusDisplay {
  return REVIEW_STATUS_DISPLAY[reviewStatus];
}

export function getHypothesisStatusDisplay(status: HypothesisStatus): StatusDisplay {
  return HYPOTHESIS_STATUS_DISPLAY[status];
}

export function getTimestampTypeDisplay(timestampType: TimestampType): StatusDisplay {
  return TIMESTAMP_TYPE_DISPLAY[timestampType];
}

export const REVIEW_STATUS_OPTIONS: readonly ReviewStatus[] = [
  'unreviewed',
  'supported',
  'partially-supported',
  'unsupported',
  'rejected',
];
