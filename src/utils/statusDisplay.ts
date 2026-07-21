import type { ChipProps } from '@mui/material';
import type { ActionCategory, ActionPriority, ActionStatus } from '../../shared/types/action';
import type { BiasType, RiskLevel } from '../../shared/types/bias';
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

const BIAS_TYPE_LABEL: Record<BiasType, string> = {
  'confirmation-bias': 'Confirmation bias',
  'anchoring-bias': 'Anchoring bias',
  'automation-bias': 'Automation bias',
  'post-hoc-fallacy': 'Post-hoc fallacy',
  'availability-bias': 'Availability bias',
  'overconfidence-bias': 'Overconfidence bias',
  'hindsight-bias': 'Hindsight bias',
  'base-rate-neglect': 'Base-rate neglect',
};

const RISK_LEVEL_DISPLAY: Record<RiskLevel, StatusDisplay> = {
  low: { label: 'Low risk', color: 'info' },
  medium: { label: 'Medium risk', color: 'warning' },
  high: { label: 'High risk', color: 'error' },
};

const ACTION_PRIORITY_DISPLAY: Record<ActionPriority, StatusDisplay> = {
  immediate: { label: 'Immediate', color: 'error' },
  high: { label: 'High', color: 'warning' },
  medium: { label: 'Medium', color: 'info' },
  low: { label: 'Low', color: 'default' },
};

const ACTION_CATEGORY_LABEL: Record<ActionCategory, string> = {
  inspect: 'Inspect',
  reproduce: 'Reproduce',
  compare: 'Compare',
  rollback: 'Rollback',
  monitor: 'Monitor',
  communicate: 'Communicate',
  'collect-evidence': 'Collect evidence',
  'configuration-check': 'Configuration check',
  'code-review': 'Code review',
  'database-check': 'Database check',
};

const ACTION_STATUS_DISPLAY: Record<ActionStatus, StatusDisplay> = {
  suggested: { label: 'Suggested', color: 'default' },
  'in-progress': { label: 'In progress', color: 'info' },
  completed: { label: 'Completed', color: 'success' },
  dismissed: { label: 'Dismissed', color: 'default' },
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

export function getBiasTypeLabel(biasType: BiasType): string {
  return BIAS_TYPE_LABEL[biasType];
}

export function getRiskLevelDisplay(riskLevel: RiskLevel): StatusDisplay {
  return RISK_LEVEL_DISPLAY[riskLevel];
}

export function getActionPriorityDisplay(priority: ActionPriority): StatusDisplay {
  return ACTION_PRIORITY_DISPLAY[priority];
}

export function getActionCategoryLabel(category: ActionCategory): string {
  return ACTION_CATEGORY_LABEL[category];
}

export function getActionStatusDisplay(status: ActionStatus): StatusDisplay {
  return ACTION_STATUS_DISPLAY[status];
}

export const REVIEW_STATUS_OPTIONS: readonly ReviewStatus[] = [
  'unreviewed',
  'supported',
  'partially-supported',
  'unsupported',
  'rejected',
];
