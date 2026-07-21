import type { ReactNode } from 'react';
import { Button, Chip, Stack, Typography } from '@mui/material';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import type { Incident } from '../../../shared/types/incident';
import { getIncidentStatusDisplay, getSeverityDisplay } from '../../utils/statusDisplay';

interface WorkspaceHeaderProps {
  incident: Incident;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

/**
 * Incident Workspace page header: title, severity/status/affected-service
 * chips, and the action to trigger (or re-trigger) AI analysis.
 */
export function WorkspaceHeader({ incident, onAnalyze, isAnalyzing }: WorkspaceHeaderProps): ReactNode {
  const severity = getSeverityDisplay(incident.severity);
  const status = getIncidentStatusDisplay(incident.status);
  const hasBeenAnalyzed = incident.analysisRuns.length > 0;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
      >
        <Stack spacing={1}>
          <Typography variant="h4" component="h1">
            {incident.title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={`Severity: ${severity.label}`} color={severity.color} variant="outlined" />
            <Chip label={`Status: ${status.label}`} color={status.color} variant="outlined" />
            <Typography variant="body2" color="text.secondary">
              Affected service: {incident.affectedService}
            </Typography>
          </Stack>
        </Stack>

        <Button
          variant="contained"
          startIcon={<InsightsOutlinedIcon />}
          onClick={onAnalyze}
          loading={isAnalyzing}
        >
          {hasBeenAnalyzed ? 'Re-run AI analysis' : 'Run AI analysis'}
        </Button>
      </Stack>
    </Stack>
  );
}
