import { useState, type ReactNode } from 'react';
import { Button, Card, CardContent, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import type { Hypothesis } from '../../../shared/types/hypothesis';
import type { SkepticReview } from '../../../shared/types/skepticReview';
import { useUpdateSkepticReviewNotes } from '../../hooks/useUpdateSkepticReviewNotes';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { EvidenceReferenceChips } from './EvidenceReferenceChips';

interface SkepticReviewCardProps {
  incidentId: string;
  review: SkepticReview;
  /** The hypothesis this review challenges, resolved by id, if it can still be found. */
  challengedHypothesis: Hypothesis | undefined;
}

/**
 * One skeptic review: the critique itself, plus an editable "review notes"
 * field a human reviewer can use to record their own take -- separate from
 * (and never overwriting) the AI-generated content above it.
 */
export function SkepticReviewCard({
  incidentId,
  review,
  challengedHypothesis,
}: SkepticReviewCardProps): ReactNode {
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);
  const notesMutation = useUpdateSkepticReviewNotes(incidentId);
  const [notesDraft, setNotesDraft] = useState(review.humanNotes ?? '');

  const notesDirty = notesDraft !== (review.humanNotes ?? '');

  function handleSaveNotes(): void {
    notesMutation.mutate({ reviewId: review.id, humanNotes: notesDraft });
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
          >
            <Stack spacing={0.5}>
              <Typography variant="h6" component="h3">
                Challenging: {challengedHypothesis?.title ?? review.challengedHypothesisId}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Reviewed {new Date(review.createdAt).toLocaleString()}
              </Typography>
            </Stack>
            <Chip
              label={
                challengedHypothesis ? `Confidence ${challengedHypothesis.confidence}/100` : 'View hypothesis'
              }
              size="small"
              variant="outlined"
              clickable
              onClick={() => setActiveSection('hypotheses')}
            />
          </Stack>

          <Typography variant="body2">{review.challengeSummary}</Typography>

          <Divider />

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Alternative explanations</Typography>
            <Stack component="ul" sx={{ pl: 2, m: 0 }}>
              {review.alternativeExplanations.map((text) => (
                <Typography key={text} component="li" variant="body2">
                  {text}
                </Typography>
              ))}
            </Stack>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Evidence the original analysis never cited</Typography>
            <EvidenceReferenceChips
              evidenceIds={review.ignoredEvidenceIds}
              emptyLabel="Every evidence item was cited somewhere in the original analysis."
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Confirmation-bias assessment</Typography>
            <Typography variant="body2">{review.confirmationBiasAssessment}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">What would falsify this hypothesis</Typography>
            <Typography variant="body2">{review.falsificationTest}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Additional recommended tests</Typography>
            <Stack component="ul" sx={{ pl: 2, m: 0 }}>
              {review.recommendedTests.map((text) => (
                <Typography key={text} component="li" variant="body2">
                  {text}
                </Typography>
              ))}
            </Stack>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Overall assessment</Typography>
            <Typography variant="body2">{review.overallAssessment}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={`Provider: ${review.provider}`} size="small" variant="outlined" />
            <Chip label={`Model: ${review.model}`} size="small" variant="outlined" />
            <Chip label={`Prompt: ${review.promptVersion}`} size="small" variant="outlined" />
            <Chip label={`Duration: ${review.durationMs}ms`} size="small" variant="outlined" />
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Review notes</Typography>
            <TextField
              multiline
              minRows={2}
              placeholder="Record your own notes on this skeptic review..."
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleSaveNotes}
                disabled={notesMutation.isPending || !notesDirty}
              >
                {notesMutation.isPending ? 'Saving…' : 'Save notes'}
              </Button>
              {!notesDirty && notesMutation.isSuccess && (
                <Typography variant="caption" color="success.main">
                  Saved
                </Typography>
              )}
              {notesMutation.isError && (
                <Typography variant="caption" color="error.main">
                  {notesMutation.error.message}
                </Typography>
              )}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
