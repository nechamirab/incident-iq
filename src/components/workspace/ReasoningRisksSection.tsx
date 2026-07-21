import type { ReactNode } from 'react';
import { Alert, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import { getLatestAnalysisRun } from '../../utils/getLatestAnalysisRun';
import { getBiasTypeLabel, getRiskLevelDisplay } from '../../utils/statusDisplay';
import { EvidenceReferenceChips } from './EvidenceReferenceChips';

interface ReasoningRisksSectionProps {
  incident: Incident;
}

/**
 * The Reasoning Risks tab: cognitive biases and fallacies the latest
 * analysis run flagged as relevant to itself -- never every known bias
 * unconditionally, only ones actually detected for this analysis.
 */
export function ReasoningRisksSection({ incident }: ReasoningRisksSectionProps): ReactNode {
  const latestRun = getLatestAnalysisRun(incident);

  if (!latestRun) {
    return (
      <Alert severity="info" variant="outlined">
        No analysis has been run yet. Reasoning risks appear here once AI analysis has been run
        for this incident.
      </Alert>
    );
  }

  if (latestRun.reasoningRisks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        The latest analysis did not flag any reasoning risks for this incident.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {latestRun.reasoningRisks.map((risk) => {
        const riskDisplay = getRiskLevelDisplay(risk.riskLevel);
        return (
          <Card key={risk.id} variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="h6" component="h3">
                      {risk.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getBiasTypeLabel(risk.biasType)} &middot; detected in: {risk.detectedIn}
                    </Typography>
                  </Stack>
                  <Chip label={riskDisplay.label} color={riskDisplay.color} size="small" />
                </Stack>

                <Typography variant="body2">{risk.description}</Typography>

                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">Suggested mitigation</Typography>
                  <Typography variant="body2">{risk.mitigation}</Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Related evidence
                  </Typography>
                  <EvidenceReferenceChips
                    evidenceIds={risk.evidenceIds}
                    emptyLabel="Not tied to specific evidence items -- this is an observation about the analysis as a whole."
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
