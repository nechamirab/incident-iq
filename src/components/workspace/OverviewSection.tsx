import type { ReactNode } from 'react';
import { Alert, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import { getLatestAnalysisRun } from '../../utils/getLatestAnalysisRun';

interface OverviewSectionProps {
  incident: Incident;
}

/**
 * The Overview tab: incident description plus the latest analysis run's
 * summary, impact, provenance (provider/model/prompt version/timestamp),
 * validation warnings, and uncertainty statement. Shows an explicit empty
 * state when no analysis has been run yet, rather than blank sections.
 */
export function OverviewSection({ incident }: OverviewSectionProps): ReactNode {
  const latestRun = getLatestAnalysisRun(incident);

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" component="h2">
              Description
            </Typography>
            <Typography variant="body1">{incident.description}</Typography>
          </Stack>
        </CardContent>
      </Card>

      {!latestRun && (
        <Alert severity="info" variant="outlined">
          No analysis has been run yet. Use "Run AI analysis" above to generate a summary,
          hypotheses, and recommended actions from this incident's evidence.
        </Alert>
      )}

      {latestRun && (
        <>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h6" component="h2">
                  Summary
                </Typography>
                <Typography variant="body1">{latestRun.summary.text}</Typography>

                {latestRun.summary.affectedComponents.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {latestRun.summary.affectedComponents.map((component) => (
                      <Chip key={component} label={component} size="small" variant="outlined" />
                    ))}
                  </Stack>
                )}

                <Divider />

                <Typography variant="subtitle2" color="text.secondary">
                  Impact
                </Typography>
                <Typography variant="body1">{latestRun.summary.impact}</Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6" component="h2">
                  Uncertainty
                </Typography>
                <Typography variant="body1">{latestRun.uncertaintyStatement}</Typography>
              </Stack>
            </CardContent>
          </Card>

          {latestRun.validationWarnings.length > 0 && (
            <Alert severity="warning" variant="outlined">
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Validation warnings
              </Typography>
              <Stack component="ul" sx={{ pl: 2, m: 0 }}>
                {latestRun.validationWarnings.map((warning) => (
                  <Typography key={warning} component="li" variant="body2">
                    {warning}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          )}

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Analysis provenance
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip label={`Provider: ${latestRun.provider}`} size="small" variant="outlined" />
                <Chip label={`Model: ${latestRun.model}`} size="small" variant="outlined" />
                <Chip
                  label={`Prompt: ${latestRun.promptVersion}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Analyzed: ${new Date(latestRun.createdAt).toLocaleString()}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Duration: ${latestRun.durationMs}ms`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
