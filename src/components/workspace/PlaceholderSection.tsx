import type { ReactNode } from 'react';
import { Alert } from '@mui/material';

interface PlaceholderSectionProps {
  label: string;
  arrivingInStage: number;
}

/** Shown for workspace tabs whose functionality hasn't been built yet. */
export function PlaceholderSection({ label, arrivingInStage }: PlaceholderSectionProps): ReactNode {
  return (
    <Alert severity="info" variant="outlined">
      {label} is not implemented yet. This section is introduced in Stage {arrivingInStage} of the
      project plan.
    </Alert>
  );
}
