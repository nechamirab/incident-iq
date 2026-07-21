import type { ReactNode } from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import { getLatestAnalysisRun } from '../../utils/getLatestAnalysisRun';
import { sortHypothesesByConfidence } from '../../utils/sortHypothesesByConfidence';
import { HypothesisCard } from './HypothesisCard';

interface HypothesesSectionProps {
  incident: Incident;
}

/**
 * The Hypotheses tab: every candidate explanation from the latest analysis
 * run, ranked by confidence (highest first) -- but every hypothesis is
 * shown with equal detail, since confidence is an investigation aid, not a
 * verdict.
 */
export function HypothesesSection({ incident }: HypothesesSectionProps): ReactNode {
  const latestRun = getLatestAnalysisRun(incident);

  if (!latestRun) {
    return (
      <Alert severity="info" variant="outlined">
        No analysis has been run yet. Hypotheses appear here once AI analysis has been run for
        this incident.
      </Alert>
    );
  }

  const hypotheses = sortHypothesesByConfidence(latestRun.hypotheses);

  if (hypotheses.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        The latest analysis did not produce any hypotheses.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {hypotheses.map((hypothesis) => (
        <HypothesisCard key={hypothesis.id} hypothesis={hypothesis} />
      ))}
    </Stack>
  );
}
