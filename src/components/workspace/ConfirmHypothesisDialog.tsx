import { useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';

interface ConfirmHypothesisDialogProps {
  open: boolean;
  hypothesisTitle: string;
  onClose: () => void;
  onConfirm: (humanReviewNote: string | undefined) => void;
  isSubmitting: boolean;
}

/**
 * Confirmation dialog shown before a hypothesis is marked
 * `confirmed-by-human` -- the one status the AI itself can never set (see
 * `shared/schemas/hypothesis.schema.ts`). Deliberately requires an explicit
 * click on "Confirm as human-verified" rather than treating this the same
 * as any other status change, since it represents a human's own
 * conclusion, not the AI's.
 */
export function ConfirmHypothesisDialog({
  open,
  hypothesisTitle,
  onClose,
  onConfirm,
  isSubmitting,
}: ConfirmHypothesisDialogProps): ReactNode {
  const [note, setNote] = useState('');

  function handleClose(): void {
    setNote('');
    onClose();
  }

  function handleConfirm(): void {
    onConfirm(note.trim() === '' ? undefined : note.trim());
  }

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        if (reason !== 'backdropClick') {
          handleClose();
        }
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby="confirm-hypothesis-dialog-title"
    >
      <DialogTitle id="confirm-hypothesis-dialog-title">Confirm as human-verified</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          You are about to mark <strong>&quot;{hypothesisTitle}&quot;</strong> as confirmed.
        </DialogContentText>
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          This records your own conclusion as a human investigator -- it is not, and never
          represents, an AI-generated conclusion. The AI can only ever propose a hypothesis; only
          you can confirm one.
        </Alert>
        <TextField
          label="Review note (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          multiline
          minRows={3}
          fullWidth
          helperText="Optional -- what confirmed this, e.g. a runbook check or a fix that resolved it."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit" disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} variant="contained" color="success" loading={isSubmitting}>
          Confirm as human-verified
        </Button>
      </DialogActions>
    </Dialog>
  );
}
