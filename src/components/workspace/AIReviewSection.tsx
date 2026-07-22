import type { ReactNode } from 'react';
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import { getLatestAnalysisRun } from '../../utils/getLatestAnalysisRun';
import { useRunSkepticReview } from '../../hooks/useRunSkepticReview';
import { RunComparisonTable } from './RunComparisonTable';
import { SkepticReviewCard } from './SkepticReviewCard';

interface AIReviewSectionProps {
  incident: Incident;
}

/**
 * The AI Review tab: audit information for the latest analysis run (its
 * provenance, validation warnings, and unsupported claims), a comparison
 * across every analysis run performed on this incident, and every skeptic
 * review -- a critical second pass that challenges the leading hypothesis
 * without ever modifying the original analysis.
 */
export function AIReviewSection({ incident }: AIReviewSectionProps): ReactNode {
  const latestRun = getLatestAnalysisRun(incident);
  const skepticMutation = useRunSkepticReview(incident.id);

  if (!latestRun) {
    return (
      <Alert severity="info" variant="outlined">
        No analysis has been run yet. Run AI analysis first, then a skeptic review can challenge
        its leading hypothesis.
      </Alert>
    );
  }

  const reviews = [...incident.skepticReviews].reverse();

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" component="h2">
              Analysis audit information
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip label={`Provider: ${latestRun.provider}`} size="small" variant="outlined" />
              <Chip label={`Model: ${latestRun.model}`} size="small" variant="outlined" />
              <Chip label={`Prompt: ${latestRun.promptVersion}`} size="small" variant="outlined" />
              <Chip
                label={`Analyzed: ${new Date(latestRun.createdAt).toLocaleString()}`}
                size="small"
                variant="outlined"
              />
              <Chip label={`Duration: ${latestRun.durationMs}ms`} size="small" variant="outlined" />
            </Stack>

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

            {latestRun.unsupportedClaims.length > 0 && (
              <Alert severity="warning" variant="outlined">
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Unsupported claims
                </Typography>
                <Stack component="ul" sx={{ pl: 2, m: 0 }}>
                  {latestRun.unsupportedClaims.map((claim) => (
                    <Typography key={claim} component="li" variant="body2">
                      {claim}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" component="h2">
              Analysis run comparison
            </Typography>
            <RunComparisonTable runs={incident.analysisRuns} />
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Typography variant="h6" component="h2">
            Skeptic review
          </Typography>
          <Button
            variant="contained"
            onClick={() => skepticMutation.mutate()}
            disabled={skepticMutation.isPending}
          >
            {skepticMutation.isPending ? 'Running skeptic review…' : 'Run skeptic review'}
          </Button>
        </Stack>

        {skepticMutation.isError && (
          <Alert severity="error" variant="outlined">
            Skeptic review failed: {skepticMutation.error.message}
          </Alert>
        )}

        {reviews.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No skeptic review has been run yet. A skeptic review critically challenges the leading
            hypothesis of the latest analysis -- searching for alternative explanations, evidence
            it ignored, and signs of confirmation bias -- without modifying the original analysis.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {reviews.map((review) => {
              const reviewedRun = incident.analysisRuns.find((run) => run.id === review.analysisRunId);
              const challengedHypothesis = reviewedRun?.hypotheses.find(
                (hypothesis) => hypothesis.id === review.challengedHypothesisId,
              );
              return (
                <SkepticReviewCard
                  key={review.id}
                  incidentId={incident.id}
                  review={review}
                  challengedHypothesis={challengedHypothesis}
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
