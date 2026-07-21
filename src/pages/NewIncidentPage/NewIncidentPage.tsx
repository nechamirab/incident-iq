import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';
import { NewIncidentForm } from '../../components/incidents/NewIncidentForm';

/**
 * Incident-creation page: introduces the workflow, then renders the New
 * Incident form.
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

      <NewIncidentForm />
    </Stack>
  );
}
