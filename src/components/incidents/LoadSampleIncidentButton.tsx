import { useState, type MouseEvent, type ReactNode } from 'react';
import { Button, Menu, MenuItem, Typography } from '@mui/material';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import type { Incident } from '../../../shared/types/incident';
import { useSampleIncidents } from '../../hooks/useSampleIncidents';

interface LoadSampleIncidentButtonProps {
  onSelect: (incident: Incident) => void;
}

/**
 * Lets the user prefill the New Incident form from one of the bundled
 * sample incidents, fetched from a dedicated backend endpoint (never
 * hardcoded in the component, and never inferred from `scenarioType` --
 * see `useSampleIncidents`) so the samples stay a single source of truth
 * and can never be confused with a user-created incident.
 */
export function LoadSampleIncidentButton({ onSelect }: LoadSampleIncidentButtonProps): ReactNode {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const incidentsQuery = useSampleIncidents();
  const samples = incidentsQuery.data ?? [];

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
