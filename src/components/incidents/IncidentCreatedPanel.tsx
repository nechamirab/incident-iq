import type { ReactNode } from 'react';
import { Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import { Link as RouterLink } from 'react-router-dom';
import type { Incident } from '../../../shared/types/incident';
import { buildIncidentWorkspacePath } from '../../constants/routes';

interface IncidentCreatedPanelProps {
  incident: Incident;
  onCreateAnother: () => void;
}

/**
 * Confirmation shown after an incident is successfully created, in place
 * of the form. The workspace link goes to the (still placeholder, until a
 * later stage) incident workspace page.
 */
export function IncidentCreatedPanel({
  incident,
  onCreateAnother,
}: IncidentCreatedPanelProps): ReactNode {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CheckCircleOutlineIcon color="success" aria-hidden="true" />
            <Typography variant="h6" component="h2">
              Incident created
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="body1">{incident.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              Incident ID: {incident.id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {incident.evidence.length} evidence{' '}
              {incident.evidence.length === 1 ? 'item was' : 'items were'} recorded.
            </Typography>
          </Stack>

          <Chip label={`Status: ${incident.status}`} variant="outlined" />

          <Stack direction="row" spacing={1.5}>
            <Button
              component={RouterLink}
              to={buildIncidentWorkspacePath(incident.id)}
              variant="contained"
            >
              View in workspace
            </Button>
            <Button variant="outlined" onClick={onCreateAnother}>
              Create another incident
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
