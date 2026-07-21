import type { ReactNode } from 'react';
import { Alert, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import type { ReasoningItem } from '../../../shared/types/reasoning';
import { useReviewStatement } from '../../hooks/useReviewStatement';
import { getLatestAnalysisRun } from '../../utils/getLatestAnalysisRun';
import { getReviewStatusDisplay } from '../../utils/statusDisplay';
import { ReviewStatusControl } from './ReviewStatusControl';

interface FactsAssumptionsSectionProps {
  incident: Incident;
}

interface ReasoningItemCardProps {
  item: ReasoningItem;
  onReview: (reviewStatus: ReasoningItem['reviewStatus']) => void;
  isSaving: boolean;
}

function ReasoningItemCard({ item, onReview, isSaving }: ReasoningItemCardProps): ReactNode {
  const reviewDisplay = getReviewStatusDisplay(item.reviewStatus);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
          >
            <Typography variant="body1">{item.statement}</Typography>
            <Chip label={reviewDisplay.label} color={reviewDisplay.color} size="small" />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {item.explanation}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={`Confidence: ${item.confidence}`} size="small" variant="outlined" />
            <Chip
              label={
                item.evidenceIds.length > 0
                  ? `${item.evidenceIds.length} evidence item(s)`
                  : 'No evidence cited'
              }
              size="small"
              variant="outlined"
            />
          </Stack>

          <ReviewStatusControl value={item.reviewStatus} onChange={onReview} disabled={isSaving} />
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * The Facts & Assumptions tab: clearly separates verified facts, unproven
 * assumptions, and unsupported AI claims (never mixed), and lets a human
 * reviewer mark any fact or assumption's review status.
 */
export function FactsAssumptionsSection({ incident }: FactsAssumptionsSectionProps): ReactNode {
  const latestRun = getLatestAnalysisRun(incident);
  const reviewMutation = useReviewStatement(incident.id);

  if (!latestRun) {
    return (
      <Alert severity="info" variant="outlined">
        No analysis has been run yet. Facts and assumptions appear here once AI analysis has been
        run for this incident.
      </Alert>
    );
  }

  return (
    <Stack spacing={4}>
      <Stack spacing={1.5}>
        <Typography variant="h6" component="h2">
          Facts ({latestRun.facts.length})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Statements directly supported by evidence.
        </Typography>
        {latestRun.facts.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No facts were extracted from this analysis.
          </Typography>
        )}
        {latestRun.facts.map((fact) => (
          <ReasoningItemCard
            key={fact.id}
            item={fact}
            isSaving={reviewMutation.isPending && reviewMutation.variables?.statementId === fact.id}
            onReview={(reviewStatus) =>
              reviewMutation.mutate({ statementId: fact.id, reviewStatus })
            }
          />
        ))}
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h6" component="h2">
          Assumptions ({latestRun.assumptions.length})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Plausible but unproven statements. Assumptions must never be treated as confirmed
          evidence.
        </Typography>
        {latestRun.assumptions.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No assumptions were recorded for this analysis.
          </Typography>
        )}
        {latestRun.assumptions.map((assumption) => (
          <ReasoningItemCard
            key={assumption.id}
            item={assumption}
            isSaving={
              reviewMutation.isPending && reviewMutation.variables?.statementId === assumption.id
            }
            onReview={(reviewStatus) =>
              reviewMutation.mutate({ statementId: assumption.id, reviewStatus })
            }
          />
        ))}
      </Stack>

      {latestRun.unsupportedClaims.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="h6" component="h2">
            Unsupported claims ({latestRun.unsupportedClaims.length})
          </Typography>
          <Alert severity="warning" variant="outlined">
            <Stack spacing={0.5}>
              <Typography variant="body2">
                These statements were flagged as lacking sufficient evidence backing. They are not
                facts and should not be treated as verified.
              </Typography>
              <Stack component="ul" sx={{ pl: 2, m: 0 }}>
                {latestRun.unsupportedClaims.map((claim) => (
                  <Typography key={claim} component="li" variant="body2">
                    {claim}
                  </Typography>
                ))}
              </Stack>
            </Stack>
          </Alert>
        </Stack>
      )}

      {reviewMutation.isError && (
        <Alert severity="error" variant="outlined">
          {reviewMutation.error.message}
        </Alert>
      )}
    </Stack>
  );
}
