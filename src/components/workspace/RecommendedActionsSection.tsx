import type { ReactNode } from 'react';
import { Alert, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import type { Hypothesis } from '../../../shared/types/hypothesis';
import type { Incident } from '../../../shared/types/incident';
import { getLatestAnalysisRun } from '../../utils/getLatestAnalysisRun';
import { sortActionsByPriority } from '../../utils/sortActionsByPriority';
import {
  getActionCategoryLabel,
  getActionPriorityDisplay,
  getActionStatusDisplay,
} from '../../utils/statusDisplay';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { EvidenceReferenceChips } from './EvidenceReferenceChips';

interface RecommendedActionsSectionProps {
  incident: Incident;
}

interface RelatedHypothesesProps {
  hypothesisIds: readonly string[];
  hypotheses: readonly Hypothesis[];
}

function RelatedHypotheses({ hypothesisIds, hypotheses }: RelatedHypothesesProps): ReactNode {
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);

  if (hypothesisIds.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not linked to a specific hypothesis.
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      {hypothesisIds.map((hypothesisId) => {
        const hypothesis = hypotheses.find((h) => h.id === hypothesisId);
        return (
          <Chip
            key={hypothesisId}
            label={hypothesis?.title ?? hypothesisId}
            size="small"
            variant="outlined"
            clickable
            onClick={() => setActiveSection('hypotheses')}
          />
        );
      })}
    </Stack>
  );
}

/**
 * The Recommended Actions tab: every action from the latest analysis run,
 * ordered by priority, each linked to the evidence and hypothesis it
 * relates to. Open investigation questions are shown alongside, since an
 * action's motivation is often "this would help answer an open question."
 */
export function RecommendedActionsSection({ incident }: RecommendedActionsSectionProps): ReactNode {
  const latestRun = getLatestAnalysisRun(incident);

  if (!latestRun) {
    return (
      <Alert severity="info" variant="outlined">
        No analysis has been run yet. Recommended actions appear here once AI analysis has been
        run for this incident.
      </Alert>
    );
  }

  const actions = sortActionsByPriority(latestRun.recommendedActions);

  return (
    <Stack spacing={3}>
      {latestRun.openQuestions.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6" component="h2">
                Open investigation questions
              </Typography>
              <Stack component="ul" sx={{ pl: 2, m: 0 }}>
                {latestRun.openQuestions.map((question) => (
                  <Typography key={question} component="li" variant="body2">
                    {question}
                  </Typography>
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {actions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          The latest analysis did not produce any recommended actions.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {actions.map((action) => {
            const priorityDisplay = getActionPriorityDisplay(action.priority);
            const statusDisplay = getActionStatusDisplay(action.status);

            return (
              <Card key={action.id} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
                    >
                      <Typography variant="h6" component="h3">
                        {action.title}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={`Priority: ${priorityDisplay.label}`}
                          color={priorityDisplay.color}
                          size="small"
                        />
                        <Chip label={statusDisplay.label} color={statusDisplay.color} size="small" />
                      </Stack>
                    </Stack>

                    <Chip
                      label={getActionCategoryLabel(action.category)}
                      size="small"
                      variant="outlined"
                      sx={{ alignSelf: 'flex-start' }}
                    />

                    <Typography variant="body2">{action.description}</Typography>

                    <Divider />

                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">Expected outcome</Typography>
                      <Typography variant="body2">{action.expectedOutcome}</Typography>
                    </Stack>

                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">Risk</Typography>
                      <Typography variant="body2">{action.risk}</Typography>
                    </Stack>

                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">Related hypothesis</Typography>
                      <RelatedHypotheses
                        hypothesisIds={action.relatedHypothesisIds}
                        hypotheses={latestRun.hypotheses}
                      />
                    </Stack>

                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">Evidence</Typography>
                      <EvidenceReferenceChips
                        evidenceIds={action.evidenceIds}
                        emptyLabel="No evidence cited for this action."
                      />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
