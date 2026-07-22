import { useEffect, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
} from '@mui/material';
import {
  ResolveIncidentFormSchema,
  type ResolveIncidentFormValues,
} from '../../schemas/resolveIncidentForm.schema';
import { ControlledTextField } from '../common/ControlledTextField';
import { toDatetimeLocalValue } from '../../utils/incidentFormMapping';

/** What {@link ResolveIncidentDialog} reports back on a confirmed resolution. */
export interface ResolveIncidentConfirmation {
  /** Full ISO-8601 timestamp, converted from the form's local date/time value. */
  resolvedAt: string;
  resolutionNotes?: string;
}

interface ResolveIncidentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (confirmation: ResolveIncidentConfirmation) => void;
  isSubmitting: boolean;
}

function buildDefaultValues(): ResolveIncidentFormValues {
  return { resolvedAt: toDatetimeLocalValue(new Date().toISOString()), resolutionNotes: '' };
}

/**
 * Confirmation dialog shown when a user selects "resolved" from the
 * incident status selector -- lets them confirm (or adjust) the resolution
 * date/time, defaulting to now, and optionally record resolution notes.
 * Cancelling closes the dialog without calling {@link onConfirm}, leaving
 * the incident's status unchanged.
 */
export function ResolveIncidentDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: ResolveIncidentDialogProps): ReactNode {
  const { control, handleSubmit, reset } = useForm<ResolveIncidentFormValues>({
    resolver: zodResolver(ResolveIncidentFormSchema),
    defaultValues: buildDefaultValues(),
  });

  // Re-seed the form (fresh "now" default, cleared notes) every time the
  // dialog opens, so a prior cancel never leaves stale values behind.
  useEffect(() => {
    if (open) {
      reset(buildDefaultValues());
    }
  }, [open, reset]);

  function handleCancel(): void {
    onClose();
  }

  function onSubmit(values: ResolveIncidentFormValues): void {
    onConfirm({
      resolvedAt: new Date(values.resolvedAt).toISOString(),
      resolutionNotes: values.resolutionNotes.trim() === '' ? undefined : values.resolutionNotes,
    });
  }

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        if (reason !== 'backdropClick') {
          onClose();
        }
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby="resolve-incident-dialog-title"
    >
      <DialogTitle id="resolve-incident-dialog-title">Confirm resolution</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <DialogContentText>
            Mark this incident as resolved. You can adjust the resolution time below and
            optionally record what fixed it.
          </DialogContentText>

          <ControlledTextField
            name="resolvedAt"
            control={control}
            label="Resolved at"
            type="datetime-local"
            required
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <ControlledTextField
            name="resolutionNotes"
            control={control}
            label="Resolution notes"
            multiline
            minRows={3}
            fullWidth
            helperText="Optional -- what fixed it, and any follow-up context."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="inherit" disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSubmit(onSubmit)()}
          variant="contained"
          loading={isSubmitting}
        >
          Confirm resolution
        </Button>
      </DialogActions>
    </Dialog>
  );
}
