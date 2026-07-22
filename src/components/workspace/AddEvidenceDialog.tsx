import { useEffect, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
} from '@mui/material';
import {
  ADD_EVIDENCE_SOURCE_TYPES,
  AddEvidenceFormSchema,
  type AddEvidenceFormValues,
} from '../../schemas/addEvidenceForm.schema';
import { useAddEvidence } from '../../hooks/useAddEvidence';
import { formatEvidenceSourceType } from '../../utils/formatEvidenceSourceType';
import { ControlledTextField } from '../common/ControlledTextField';

const DEFAULT_VALUES: AddEvidenceFormValues = {
  sourceType: 'application-log',
  sourceName: '',
  content: '',
  timestamp: '',
};

interface AddEvidenceDialogProps {
  open: boolean;
  incidentId: string;
  onClose: () => void;
  /** Called after the evidence item is successfully persisted, just before the dialog closes. */
  onAdded: () => void;
}

/**
 * "Add Evidence Item" dialog: a React Hook Form + Zod-validated form for
 * manually adding one evidence item (application log snippet, monitoring
 * alert, or support/user message) to an already-existing incident. Closes
 * and resets only on a successful submission; a failed submission leaves
 * the dialog open with the entered values intact and an inline error.
 */
export function AddEvidenceDialog({ open, incidentId, onClose, onAdded }: AddEvidenceDialogProps): ReactNode {
  const addEvidenceMutation = useAddEvidence(incidentId);

  const { control, handleSubmit, reset } = useForm<AddEvidenceFormValues>({
    resolver: zodResolver(AddEvidenceFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(DEFAULT_VALUES);
      addEvidenceMutation.reset();
    }
    // Only re-seed when the dialog transitions open; re-running on every
    // mutation-state change would fight the "stay open after failure" rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  function handleCancel(): void {
    onClose();
  }

  function onSubmit(values: AddEvidenceFormValues): void {
    addEvidenceMutation.mutate(
      {
        sourceType: values.sourceType,
        sourceName: values.sourceName,
        content: values.content,
        timestamp: values.timestamp === '' ? undefined : new Date(values.timestamp).toISOString(),
      },
      {
        onSuccess: () => {
          onAdded();
          onClose();
        },
      },
    );
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
      aria-labelledby="add-evidence-dialog-title"
    >
      <DialogTitle id="add-evidence-dialog-title">Add evidence item</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <ControlledTextField
            name="sourceType"
            control={control}
            select
            label="Evidence type"
            required
            fullWidth
          >
            {ADD_EVIDENCE_SOURCE_TYPES.map((sourceType) => (
              <MenuItem key={sourceType} value={sourceType}>
                {formatEvidenceSourceType(sourceType)}
              </MenuItem>
            ))}
          </ControlledTextField>

          <ControlledTextField
            name="sourceName"
            control={control}
            label="Source name or title"
            required
            fullWidth
            placeholder="e.g. checkout-api.log, Datadog, Support ticket #4821"
          />

          <ControlledTextField
            name="content"
            control={control}
            label="Evidence content"
            required
            fullWidth
            multiline
            minRows={3}
          />

          <ControlledTextField
            name="timestamp"
            control={control}
            label="Timestamp"
            type="datetime-local"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Optional -- leave blank if the exact time isn't known."
          />

          {addEvidenceMutation.isError && (
            <Alert severity="error" variant="outlined">
              Could not add evidence: {addEvidenceMutation.error.message}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="inherit" disabled={addEvidenceMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSubmit(onSubmit)()}
          variant="contained"
          loading={addEvidenceMutation.isPending}
        >
          Add evidence
        </Button>
      </DialogActions>
    </Dialog>
  );
}
