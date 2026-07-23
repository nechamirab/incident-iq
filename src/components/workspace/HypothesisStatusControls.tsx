import { useState, type MouseEvent, type ReactNode } from 'react';
import { Alert, Button, Menu, MenuItem, Snackbar, Stack, Typography } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import VerifiedIcon from '@mui/icons-material/Verified';
import type { Hypothesis, HypothesisStatus } from '../../../shared/types/hypothesis';
import { useUpdateHypothesisStatus } from '../../hooks/useUpdateHypothesisStatus';
import { getHypothesisStatusDisplay } from '../../utils/statusDisplay';
import { ConfirmHypothesisDialog } from './ConfirmHypothesisDialog';

/** Statuses a human reviewer can select directly from the menu -- `proposed` is the AI's own starting point, never a target a reviewer selects back to, and `confirmed-by-human` always goes through {@link ConfirmHypothesisDialog} instead. */
const SELECTABLE_STATUSES: readonly Exclude<HypothesisStatus, 'proposed' | 'confirmed-by-human'>[] = [
  'testing',
  'supported',
  'weakened',
  'rejected',
];

interface HypothesisStatusControlsProps {
  incidentId: string;
  hypothesis: Hypothesis;
}

/**
 * Lets a human reviewer change a hypothesis's status, including confirming
 * it as human-verified -- the one status the AI can never set itself (see
 * `shared/schemas/hypothesis.schema.ts`). Mirrors `IncidentStatusSelector`'s
 * button-triggered-menu-plus-confirmation-dialog pattern: every ordinary
 * status change applies immediately via {@link useUpdateHypothesisStatus}'s
 * optimistic mutation, while confirming opens {@link ConfirmHypothesisDialog}
 * first, since that specifically represents a human's own conclusion.
 */
export function HypothesisStatusControls({ incidentId, hypothesis }: HypothesisStatusControlsProps): ReactNode {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(
    null,
  );

  const statusMutation = useUpdateHypothesisStatus(incidentId);
  const menuOpen = Boolean(anchorEl);

  function handleOpenMenu(event: MouseEvent<HTMLButtonElement>): void {
    setAnchorEl(event.currentTarget);
  }

  function handleCloseMenu(): void {
    setAnchorEl(null);
  }

  function handleSelectStatus(status: (typeof SELECTABLE_STATUSES)[number]): void {
    handleCloseMenu();
    statusMutation.mutate(
      { hypothesisId: hypothesis.id, payload: { status } },
      {
        onSuccess: () => {
          setFeedback({
            severity: 'success',
            message: `Hypothesis marked "${getHypothesisStatusDisplay(status).label}".`,
          });
        },
        onError: (error) => {
          setFeedback({ severity: 'error', message: `Could not update hypothesis: ${error.message}` });
        },
      },
    );
  }

  function handleOpenConfirmDialog(): void {
    handleCloseMenu();
    setConfirmDialogOpen(true);
  }

  function handleConfirm(humanReviewNote: string | undefined): void {
    statusMutation.mutate(
      { hypothesisId: hypothesis.id, payload: { status: 'confirmed-by-human', confirmed: true, humanReviewNote } },
      {
        onSuccess: () => {
          setConfirmDialogOpen(false);
          setFeedback({ severity: 'success', message: 'Hypothesis confirmed as human-verified.' });
        },
        onError: (error) => {
          setFeedback({ severity: 'error', message: `Could not confirm hypothesis: ${error.message}` });
        },
      },
    );
  }

  const alreadyConfirmed = hypothesis.status === 'confirmed-by-human';

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          endIcon={<ArrowDropDownIcon />}
          onClick={handleOpenMenu}
          disabled={statusMutation.isPending || alreadyConfirmed}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Change review status for hypothesis "${hypothesis.title}"`}
        >
          Change status
        </Button>

        {!alreadyConfirmed && (
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<VerifiedIcon />}
            onClick={handleOpenConfirmDialog}
            disabled={statusMutation.isPending}
          >
            Confirm as human-verified
          </Button>
        )}

        <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleCloseMenu}>
          {SELECTABLE_STATUSES.map((status) => (
            <MenuItem
              key={status}
              selected={status === hypothesis.status}
              onClick={() => handleSelectStatus(status)}
            >
              Mark as {getHypothesisStatusDisplay(status).label}
            </MenuItem>
          ))}
        </Menu>
      </Stack>

      {(hypothesis.reviewedAt ?? hypothesis.humanReviewNote) && (
        <Typography variant="caption" color="text.secondary">
          Reviewed{hypothesis.reviewedAt ? ` on ${new Date(hypothesis.reviewedAt).toLocaleString()}` : ''}
          {hypothesis.humanReviewNote ? ` -- "${hypothesis.humanReviewNote}"` : ''}
        </Typography>
      )}

      <ConfirmHypothesisDialog
        open={confirmDialogOpen}
        hypothesisTitle={hypothesis.title}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleConfirm}
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
