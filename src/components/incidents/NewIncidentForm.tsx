import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, MenuItem, Stack, Typography } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import type { Incident } from '../../../shared/types/incident';
import { IncidentSeveritySchema } from '../../../shared/schemas/incident.schema';
import { EVIDENCE_TEXT_FIELDS } from '../../../shared/constants/evidenceFields';
import { buildIncidentWorkspacePath } from '../../constants/routes';
import { NewIncidentFormSchema, type NewIncidentFormValues } from '../../schemas/newIncidentForm.schema';
import { useCreateIncident } from '../../hooks/useCreateIncident';
import { analyzeIncident } from '../../services/analysisService';
import { buildFormValuesFromIncident } from '../../utils/incidentFormMapping';
import { computeFileSubmissionError } from '../../utils/fileValidation';
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
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  /**
   * Bumped whenever the file selection is cleared from outside
   * `FileUploadZone` (form reset, loading a sample incident) to force it to
   * remount -- `FileUploadZone` owns its own rejection-error/preview/
   * expanded-row state internally, and none of that is reachable from here
   * except by giving it a fresh `key`, the standard way to fully reset a
   * child's self-contained state without lifting it up or duplicating it.
   */
  const [uploadZoneResetKey, setUploadZoneResetKey] = useState(0);
  const createIncidentMutation = useCreateIncident();

  const { control, handleSubmit, reset } = useForm<NewIncidentFormValues>({
    resolver: zodResolver(NewIncidentFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  /**
   * When the backend rejects the submission specifically because of an
   * uploaded file (an empty/whitespace-only file, malformed JSON/CSV, or an
   * unsupported type/MIME the client didn't catch), that message is shown
   * inside `FileUploadZone` instead of the generic error alert below --
   * `computeFileSubmissionError` is the single switch that decides which
   * one, so a file-selection error is never rendered in both places at
   * once. Any other backend/form-submission error still falls through to
   * the generic alert.
   */
  const fileSubmissionError = computeFileSubmissionError(
    createIncidentMutation.isError,
    createIncidentMutation.error,
  );

  function handleResetForm(): void {
    reset(DEFAULT_VALUES);
    setFiles([]);
    setUploadZoneResetKey((key) => key + 1);
    createIncidentMutation.reset();
    setAnalyzeError(null);
  }

  function handleLoadSample(incident: Incident): void {
    reset(buildFormValuesFromIncident(incident));
    setFiles([]);
    setUploadZoneResetKey((key) => key + 1);
  }

  function handleCreateAnother(): void {
    setCreatedIncident(null);
    handleResetForm();
  }

  async function onSaveDraft(values: NewIncidentFormValues): Promise<void> {
    const incident = await createIncidentMutation.mutateAsync({ values, files });
    setCreatedIncident(incident);
  }

  /**
   * Creates the incident, then immediately triggers AI analysis on it and
   * navigates to its workspace. If analysis itself fails, the incident was
   * still created successfully, so we navigate anyway -- the workspace's
   * Overview tab shows a clear "no analysis yet" state with a retry action,
   * rather than losing the user's just-submitted incident.
   */
  async function onSaveAndAnalyze(values: NewIncidentFormValues): Promise<void> {
    const incident = await createIncidentMutation.mutateAsync({ values, files });

    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      await analyzeIncident(incident.id);
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : 'Analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }

    void navigate(buildIncidentWorkspacePath(incident.id));
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
      onSubmit={(event) => void handleSubmit(onSaveDraft)(event)}
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
            <FileUploadZone
              key={uploadZoneResetKey}
              files={files}
              onChange={setFiles}
              externalError={fileSubmissionError}
              onDismissExternalError={() => createIncidentMutation.reset()}
            />
          </Stack>
        </CardContent>
      </Card>

      {createIncidentMutation.isError && !fileSubmissionError && (
        <Alert severity="error" variant="outlined">
          {createIncidentMutation.error.message}
        </Alert>
      )}

      {analyzeError && (
        <Alert severity="warning" variant="outlined">
          The incident was created, but analysis could not be started: {analyzeError}. You can
          retry analysis from the incident workspace.
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

        <Button
          type="button"
          variant="outlined"
          startIcon={<InsightsOutlinedIcon />}
          loading={createIncidentMutation.isPending || isAnalyzing}
          onClick={() => void handleSubmit(onSaveAndAnalyze)()}
        >
          Save &amp; analyze incident
        </Button>

        <Button
          variant="text"
          color="inherit"
          startIcon={<RestartAltIcon />}
          onClick={handleResetForm}
          disabled={createIncidentMutation.isPending || isAnalyzing}
        >
          Reset form
        </Button>
      </Stack>
    </Stack>
  );
}
