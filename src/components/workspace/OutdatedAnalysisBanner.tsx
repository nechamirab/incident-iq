import type { ReactNode } from 'react';
import { Alert, Button } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import { getAnalysisFreshness } from '../../utils/analysisFreshness';

interface OutdatedAnalysisBannerProps {
  incident: Incident;
  onReanalyze: () => void;
  isAnalyzing: boolean;
}

/**
 * Shown only when new evidence was added after the incident's latest
 * successful analysis run (see `getAnalysisFreshness`): explains that the
 * existing analysis results remain visible but may not reflect the new
 * evidence, and offers an explicit "Re-run AI analysis" action. Never
 * triggers analysis automatically -- the caller passes in the same
 * `useAnalyzeIncident` mutation (and its `isPending` state) already wired
 * to the workspace header's own "Re-run AI analysis" button, so both
 * triggers share one in-flight request and a second simultaneous one is
 * never possible.
 */
export function OutdatedAnalysisBanner({
  incident,
  onReanalyze,
  isAnalyzing,
}: OutdatedAnalysisBannerProps): ReactNode {
  if (getAnalysisFreshness(incident) !== 'outdated') {
    return null;
  }

  return (
    <Alert
      severity="info"
      variant="outlined"
      action={
        <Button color="inherit" size="small" onClick={onReanalyze} disabled={isAnalyzing}>
          {isAnalyzing ? 'Re-running…' : 'Re-run AI analysis'}
        </Button>
      }
    >
      New evidence was added after the latest analysis. Re-run the analysis to include it -- the
      results below remain visible in the meantime but may not reflect this newer evidence.
    </Alert>
  );
}
