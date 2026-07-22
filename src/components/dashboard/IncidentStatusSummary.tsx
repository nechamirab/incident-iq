import type { ReactNode } from 'react';
import { Chip, Stack } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import { summarizeIncidentsByStatus } from '../../utils/summarizeIncidentsByStatus';
import { getIncidentStatusDisplay } from '../../utils/statusDisplay';

interface IncidentStatusSummaryProps {
  incidents: readonly Incident[];
}

/**
 * A row of status-count chips summarizing every incident on the Dashboard,
 * in a fixed lifecycle order, including zero-count statuses so the row
 * never reflows as counts change.
 */
export function IncidentStatusSummary({ incidents }: IncidentStatusSummaryProps): ReactNode {
  const counts = summarizeIncidentsByStatus(incidents);

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Chip label={`${incidents.length} total`} variant="outlined" />
      {counts.map(({ status, count }) => {
        const display = getIncidentStatusDisplay(status);
        return (
          <Chip
            key={status}
            label={`${count} ${display.label}`}
            color={display.color}
            variant={count === 0 ? 'outlined' : 'filled'}
          />
        );
      })}
    </Stack>
  );
}
