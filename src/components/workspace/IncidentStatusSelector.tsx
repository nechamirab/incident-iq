import { useState, type MouseEvent, type ReactNode } from 'react';
import { Alert, Button, Menu, MenuItem, Snackbar, Stack } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { UserSelectableIncidentStatusSchema } from '../../../shared/schemas/incident.schema';
import type { Incident, UserSelectableIncidentStatus } from '../../../shared/types/incident';
import { useUpdateIncidentStatus } from '../../hooks/useUpdateIncidentStatus';
import { getIncidentStatusDisplay, type StatusDisplay } from '../../utils/statusDisplay';
import { ResolveIncidentDialog, type ResolveIncidentConfirmation } from './ResolveIncidentDialog';

/** DOM id of the selector's trigger, so other UI (e.g. the investigation progress banner) can focus it directly. */
export const INCIDENT_STATUS_SELECTOR_TRIGGER_ID = 'incident-status-selector-trigger';

interface IncidentStatusSelectorProps {
  incident: Incident;
}

/** MUI `Button` doesn't accept `"default"` as a `color` -- `Chip` does. Maps the shared display color accordingly. */
function toButtonColor(color: StatusDisplay['color']): 'inherit' | Exclude<StatusDisplay['color'], 'default'> {
  return color === 'default' ? 'inherit' : color;
}

/**
 * Editable incident-status control: an accessible button-triggered menu
 * (matching the same pattern `LoadSampleIncidentButton` already uses)
 * offering every user-selectable status, each labeled with text (never
 * color alone). Selecting `resolved` opens {@link ResolveIncidentDialog}
 * for confirmation instead of updating immediately; every other selection
 * updates right away via {@link useUpdateIncidentStatus}'s optimistic
 * mutation.
 */
export function IncidentStatusSelector({ incident }: IncidentStatusSelectorProps): ReactNode {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(
    null,
  );

  const statusMutation = useUpdateIncidentStatus(incident.id);
  const statusDisplay = getIncidentStatusDisplay(incident.status);
  const menuOpen = Boolean(anchorEl);

  function handleOpenMenu(event: MouseEvent<HTMLButtonElement>): void {
    setAnchorEl(event.currentTarget);
  }

  function handleCloseMenu(): void {
    setAnchorEl(null);
  }

  function handleSelectStatus(status: UserSelectableIncidentStatus): void {
    handleCloseMenu();

    if (status === 'resolved') {
      setResolveDialogOpen(true);
      return;
    }

    statusMutation.mutate(
      { status },
      {
        onSuccess: () => {
          setFeedback({
            severity: 'success',
            message: `Status updated to "${getIncidentStatusDisplay(status).label}".`,
          });
        },
        onError: (error) => {
          setFeedback({ severity: 'error', message: `Could not update status: ${error.message}` });
        },
      },
    );
  }

  function handleConfirmResolution(confirmation: ResolveIncidentConfirmation): void {
    statusMutation.mutate(
      {
        status: 'resolved',
        resolvedAt: confirmation.resolvedAt,
        resolutionNotes: confirmation.resolutionNotes,
      },
      {
        onSuccess: () => {
          setResolveDialogOpen(false);
          setFeedback({ severity: 'success', message: 'Incident marked resolved.' });
        },
        onError: (error) => {
          setFeedback({ severity: 'error', message: `Could not resolve incident: ${error.message}` });
        },
      },
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        id={INCIDENT_STATUS_SELECTOR_TRIGGER_ID}
        variant="outlined"
        color={toButtonColor(statusDisplay.color)}
        endIcon={<ArrowDropDownIcon />}
        onClick={handleOpenMenu}
        disabled={statusMutation.isPending}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        Status: {statusDisplay.label}
      </Button>

      <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleCloseMenu}>
        {UserSelectableIncidentStatusSchema.options.map((status) => {
          const display = getIncidentStatusDisplay(status);
          return (
            <MenuItem
              key={status}
              selected={status === incident.status}
              onClick={() => handleSelectStatus(status)}
            >
              {display.label}
            </MenuItem>
          );
        })}
      </Menu>

      <ResolveIncidentDialog
        open={resolveDialogOpen}
        onClose={() => setResolveDialogOpen(false)}
        onConfirm={handleConfirmResolution}
        isSubmitting={statusMutation.isPending}
      />

      <Snackbar
        open={feedback?.severity === 'success'}
        autoHideDuration={4000}
        onClose={() => setFeedback(null)}
        message={feedback?.severity === 'success' ? feedback.message : undefined}
      />

      {feedback?.severity === 'error' && (
        <Alert severity="error" variant="outlined" onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}
    </Stack>
  );
}
