import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useHealthCheck } from '../../hooks/useHealthCheck';
import { ROUTES } from '../../constants/routes';

/**
 * Landing page: introduces IncidentIQ and reports backend connectivity.
 * Incident metrics and listings are introduced in a later development stage.
 */
export function DashboardPage(): ReactNode {
  const healthCheck = useHealthCheck();

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          IncidentIQ
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
          An AI-assisted incident-response workspace that helps engineering teams organize
          evidence, reconstruct timelines, and reason carefully about root causes &mdash; without
          letting the system declare a definitive answer on your behalf.
        </Typography>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" component="h2">
              Backend connection
            </Typography>

            {healthCheck.isLoading ? (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <CircularProgress size={18} aria-hidden="true" />
                <Typography role="status" color="text.secondary">
                  Checking connection to the IncidentIQ API&hellip;
                </Typography>
              </Stack>
            ) : null}

            {healthCheck.isError ? (
              <Alert severity="error" variant="outlined">
                Could not reach the backend API: {healthCheck.error.message}
              </Alert>
            ) : null}

            {healthCheck.isSuccess ? (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  label={`Status: ${healthCheck.data.status}`}
                  color="success"
                  variant="outlined"
                />
                <Typography variant="body2" color="text.secondary">
                  Service: {healthCheck.data.service} &middot; Environment:{' '}
                  {healthCheck.data.environment} &middot; Uptime:{' '}
                  {Math.round(healthCheck.data.uptimeSeconds)}s
                </Typography>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Box>
        <Button component={RouterLink} to={ROUTES.newIncident} variant="contained" size="large">
          Start a new incident
        </Button>
      </Box>
    </Stack>
  );
}
