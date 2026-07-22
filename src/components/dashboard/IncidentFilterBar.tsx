import type { ReactNode } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import { IncidentSeveritySchema, IncidentStatusSchema } from '../../../shared/schemas/incident.schema';
import { getIncidentStatusDisplay, getSeverityDisplay } from '../../utils/statusDisplay';
import {
  INCIDENT_SEVERITY_FILTER_ALL,
  INCIDENT_STATUS_FILTER_ALL,
  type IncidentSeverityFilter,
  type IncidentStatusFilter,
} from '../../utils/filterIncidents';

interface IncidentFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: IncidentStatusFilter;
  onStatusChange: (value: IncidentStatusFilter) => void;
  severity: IncidentSeverityFilter;
  onSeverityChange: (value: IncidentSeverityFilter) => void;
}

/**
 * Search-by-text plus status/severity filter controls for the Dashboard's
 * incident list.
 */
export function IncidentFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  severity,
  onSeverityChange,
}: IncidentFilterBarProps): ReactNode {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        label="Search incidents"
        fullWidth
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by title, service, or id"
      />
      <TextField
        select
        label="Status"
        sx={{ minWidth: { sm: 200 } }}
        value={status}
        onChange={(event) => onStatusChange(event.target.value as IncidentStatusFilter)}
      >
        <MenuItem value={INCIDENT_STATUS_FILTER_ALL}>All statuses</MenuItem>
        {IncidentStatusSchema.options.map((option) => (
          <MenuItem key={option} value={option}>
            {getIncidentStatusDisplay(option).label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Severity"
        sx={{ minWidth: { sm: 200 } }}
        value={severity}
        onChange={(event) => onSeverityChange(event.target.value as IncidentSeverityFilter)}
      >
        <MenuItem value={INCIDENT_SEVERITY_FILTER_ALL}>All severities</MenuItem>
        {IncidentSeveritySchema.options.map((option) => (
          <MenuItem key={option} value={option}>
            {getSeverityDisplay(option).label}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
