import { useState, type MouseEvent, type ReactNode } from 'react';
import { Button, Menu, MenuItem, Typography } from '@mui/material';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import type { Incident } from '../../../shared/types/incident';
import { useIncidents } from '../../hooks/useIncidents';

interface LoadSampleIncidentButtonProps {
  onSelect: (incident: Incident) => void;
}

/**
 * Lets the user prefill the New Incident form from one of the bundled
 * sample incidents, fetched from the backend (never hardcoded in the
 * component) so the samples stay a single source of truth.
 */
export function LoadSampleIncidentButton({ onSelect }: LoadSampleIncidentButtonProps): ReactNode {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const incidentsQuery = useIncidents();
  const samples = (incidentsQuery.data ?? []).filter(
    (incident) => incident.scenarioType !== 'custom',
  );

  function handleOpen(event: MouseEvent<HTMLButtonElement>): void {
    setAnchorEl(event.currentTarget);
  }

  function handleSelect(incident: Incident): void {
    onSelect(incident);
    setAnchorEl(null);
  }

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<ScienceOutlinedIcon />}
        onClick={handleOpen}
        disabled={incidentsQuery.isLoading}
      >
        Load sample incident
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {samples.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2">No sample incidents available.</Typography>
          </MenuItem>
        ) : (
          samples.map((incident) => (
            <MenuItem key={incident.id} onClick={() => handleSelect(incident)}>
              {incident.title}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
