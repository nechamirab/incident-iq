import type { ReactNode } from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';

/**
 * Placeholder for the incident investigation workspace (overview, evidence,
 * timeline, hypotheses, reasoning risks, actions, AI review, postmortem).
 * Those sections are introduced in later development stages.
 */
export function IncidentWorkspacePage(): ReactNode {
  const { incidentId } = useParams<{ incidentId: string }>();

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Incident Workspace
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Incident ID: {incidentId}
        </Typography>
      </Stack>

      <Alert severity="info" variant="outlined">
        The investigation workspace (overview, evidence, timeline, hypotheses, reasoning risks,
        recommended actions, AI review, and postmortem) is not implemented yet. This page
        currently establishes navigation and layout only.
      </Alert>
    </Stack>
  );
}
