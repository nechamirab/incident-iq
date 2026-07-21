import type { ReactNode } from 'react';
import { Alert, Stack, Typography } from '@mui/material';

/**
 * Placeholder for the incident-creation form. The full form, file upload,
 * and validation logic are introduced in a later development stage.
 */
export function NewIncidentPage(): ReactNode {
  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          New Incident
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Describe an incident and attach supporting evidence for investigation.
        </Typography>
      </Stack>

      <Alert severity="info" variant="outlined">
        The incident intake form, file upload, and evidence preview are not implemented yet. This
        page currently establishes navigation and layout only.
      </Alert>
    </Stack>
  );
}
