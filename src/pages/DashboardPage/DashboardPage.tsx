import { useState, type ReactNode } from 'react';
import {
  Alert,
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
import { useIncidents } from '../../hooks/useIncidents';
import { ROUTES } from '../../constants/routes';
import { IncidentFilterBar } from '../../components/dashboard/IncidentFilterBar';
import { IncidentListTable } from '../../components/dashboard/IncidentListTable';
import { IncidentStatusSummary } from '../../components/dashboard/IncidentStatusSummary';
import {
  filterIncidents,
  INCIDENT_SEVERITY_FILTER_ALL,
  INCIDENT_STATUS_FILTER_ALL,
  type IncidentSeverityFilter,
  type IncidentStatusFilter,
} from '../../utils/filterIncidents';
import { sortIncidentsByUpdatedAt } from '../../utils/sortIncidentsByUpdatedAt';

/**
 * Landing page: introduces IncidentIQ, lists every incident (searchable and
 * filterable by status/severity, most recently updated first, each row
 * linking straight to its workspace), and reports backend connectivity.
 */
export function DashboardPage(): ReactNode {
  const healthCheck = useHealthCheck();
  const incidentsQuery = useIncidents();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<IncidentStatusFilter>(INCIDENT_STATUS_FILTER_ALL);
  const [severity, setSeverity] = useState<IncidentSeverityFilter>(INCIDENT_SEVERITY_FILTER_ALL);

  const incidents = incidentsQuery.data ?? [];
  const sortedIncidents = sortIncidentsByUpdatedAt(incidents);
  const filteredIncidents = filterIncidents(sortedIncidents, { search, status, severity });

  return (
    <Stack spacing={4}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
      >
        <Stack spacing={1}>
          <Typography variant="h4" component="h1">
            IncidentIQ
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
            An AI-assisted incident-response workspace that helps engineering teams organize
            evidence, reconstruct timelines, and reason carefully about root causes &mdash;
            without letting the system declare a definitive answer on your behalf.
          </Typography>
        </Stack>

        <Button component={RouterLink} to={ROUTES.newIncident} variant="contained" size="large">
          Start a new incident
        </Button>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          Incidents
        </Typography>

        {incidentsQuery.isLoading && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} aria-hidden="true" />
            <Typography role="status" color="text.secondary">
              Loading incidents&hellip;
            </Typography>
          </Stack>
        )}

        {incidentsQuery.isError && (
          <Alert severity="error" variant="outlined">
            Could not load incidents: {incidentsQuery.error.message}
          </Alert>
        )}

        {incidentsQuery.isSuccess && incidents.length === 0 && (
          <Alert severity="info" variant="outlined">
            No incidents yet. Click "Start a new incident" above to create your first one.
          </Alert>
        )}

        {incidentsQuery.isSuccess && incidents.length > 0 && (
          <>
            <IncidentStatusSummary incidents={incidents} />

            <IncidentFilterBar
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
              severity={severity}
              onSeverityChange={setSeverity}
            />

            <Typography variant="body2" color="text.secondary">
              {filteredIncidents.length} of {incidents.length} incident(s)
            </Typography>

            <IncidentListTable incidents={filteredIncidents} />
          </>
        )}
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="text.secondary">
              Backend connection
            </Typography>

            {healthCheck.isLoading && (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <CircularProgress size={18} aria-hidden="true" />
                <Typography role="status" color="text.secondary">
                  Checking connection to the IncidentIQ API&hellip;
                </Typography>
              </Stack>
            )}

            {healthCheck.isError && (
              <Alert severity="error" variant="outlined">
                Could not reach the backend API: {healthCheck.error.message}
              </Alert>
            )}

            {healthCheck.isSuccess && (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  label={`Status: ${healthCheck.data.status}`}
                  color="success"
                  variant="outlined"
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  Service: {healthCheck.data.service} &middot; Environment:{' '}
                  {healthCheck.data.environment} &middot; Uptime:{' '}
                  {Math.round(healthCheck.data.uptimeSeconds)}s
                </Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
