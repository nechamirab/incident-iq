import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert, Box, Button, Card, CardContent, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import type { Incident } from '../../../shared/types/incident';
import { IncidentSeveritySchema } from '../../../shared/schemas/incident.schema';
import { EVIDENCE_TEXT_FIELDS } from '../../../shared/constants/evidenceFields';
import { NewIncidentFormSchema, type NewIncidentFormValues } from '../../schemas/newIncidentForm.schema';
import { useCreateIncident } from '../../hooks/useCreateIncident';
import { buildFormValuesFromIncident } from '../../utils/incidentFormMapping';
import { ControlledTextField } from '../common/ControlledTextField';
import { FileUploadZone } from '../evidence/FileUploadZone';
import { IncidentCreatedPanel } from './IncidentCreatedPanel';
import { LoadSampleIncidentButton } from './LoadSampleIncidentButton';

const DEFAULT_VALUES: NewIncidentFormValues = {
  title: '',
  description: '',
  severity: 'medium',
  affectedService: '',
  startedAt: '',
  detectedAt: '',
  applicationLogs: '',
  errorTraces: '',
  monitoringAlerts: '',
  deploymentNotes: '',
  userComplaints: '',
  apiErrors: '',
  databaseErrors: '',
  scenarioType: 'custom',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

/**
 * The New Incident form: incident metadata, free-form evidence fields,
 * and file upload, validated with React Hook Form + Zod. Every field is
 * bound via {@link ControlledTextField} rather than `register()`, so
 * programmatic fills (Load sample incident, Reset form) render correctly
 * instead of leaving MUI's labels un-shrunk. Business logic (submission,
 * sample prefill) is delegated to hooks and utilities so this component
 * stays focused on layout and wiring.
 */
export function NewIncidentForm(): ReactNode {
  const [files, setFiles] = useState<File[]>([]);
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null);
  const createIncidentMutation = useCreateIncident();

  const { control, handleSubmit, reset } = useForm<NewIncidentFormValues>({
    resolver: zodResolver(NewIncidentFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  function handleResetForm(): void {
    reset(DEFAULT_VALUES);
    setFiles([]);
    createIncidentMutation.reset();
  }

  function handleLoadSample(incident: Incident): void {
    reset(buildFormValuesFromIncident(incident));
    setFiles([]);
  }

  function handleCreateAnother(): void {
    setCreatedIncident(null);
    handleResetForm();
  }

  async function onSubmit(values: NewIncidentFormValues): Promise<void> {
    const incident = await createIncidentMutation.mutateAsync({ values, files });
    setCreatedIncident(incident);
  }

  if (createdIncident) {
    return (
      <IncidentCreatedPanel incident={createdIncident} onCreateAnother={handleCreateAnother} />
    );
  }

  return (
    <Stack
      component="form"
      noValidate
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      spacing={4}
    >
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <LoadSampleIncidentButton onSelect={handleLoadSample} />
      </Stack>

      <Alert severity="warning" variant="outlined">
        Logs and error traces from real production systems may contain sensitive information
        (customer data, credentials, tokens). Review evidence before submitting it, and avoid
        pasting secrets you would not want stored. Automatic redaction is not applied at this
        stage.
      </Alert>

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant="h6" component="h2">
              Incident details
            </Typography>

            <ControlledTextField
              name="title"
              control={control}
              label="Title"
              required
              fullWidth
            />

            <ControlledTextField
              name="description"
              control={control}
              label="Description"
              required
              fullWidth
              multiline
              minRows={3}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <ControlledTextField
                name="severity"
                control={control}
                select
                label="Severity"
                required
                fullWidth
              >
                {IncidentSeveritySchema.options.map((severity) => (
                  <MenuItem key={severity} value={severity}>
                    {SEVERITY_LABELS[severity]}
                  </MenuItem>
                ))}
              </ControlledTextField>

              <ControlledTextField
                name="affectedService"
                control={control}
                label="Affected service"
                required
                fullWidth
                placeholder="e.g. checkout-api"
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <ControlledTextField
                name="startedAt"
                control={control}
                label="Incident start time"
                type="datetime-local"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Optional, if known."
              />

              <ControlledTextField
                name="detectedAt"
                control={control}
                label="Detection time"
                type="datetime-local"
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" component="h2">
                Evidence
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Paste relevant text into any of the fields below. Each non-empty line becomes a
                separate, individually-referenceable piece of evidence.
              </Typography>
            </Box>

            {EVIDENCE_TEXT_FIELDS.map((config) => (
              <ControlledTextField
                key={config.field}
                name={config.field}
                control={control}
                label={config.label}
                fullWidth
                multiline
                minRows={2}
                helperText={config.helperText}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Upload files
            </Typography>
            <FileUploadZone files={files} onChange={setFiles} />
          </Stack>
        </CardContent>
      </Card>

      {createIncidentMutation.isError && (
        <Alert severity="error" variant="outlined">
          {createIncidentMutation.error.message}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <Button
          type="submit"
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          loading={createIncidentMutation.isPending}
        >
          Save draft
        </Button>

        <Tooltip title="AI-assisted analysis is introduced in a later development stage.">
          <span>
            <Button variant="outlined" startIcon={<InsightsOutlinedIcon />} disabled>
              Analyze incident
            </Button>
          </span>
        </Tooltip>

        <Button
          variant="text"
          color="inherit"
          startIcon={<RestartAltIcon />}
          onClick={handleResetForm}
          disabled={createIncidentMutation.isPending}
        >
          Reset form
        </Button>
      </Stack>
    </Stack>
  );
}
