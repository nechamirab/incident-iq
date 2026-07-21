import type { ReactNode } from 'react';
import { Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import type { Hypothesis } from '../../../shared/types/hypothesis';
import { getHypothesisStatusDisplay } from '../../utils/statusDisplay';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { EvidenceReferenceChips } from './EvidenceReferenceChips';

interface HypothesisCardProps {
  hypothesis: Hypothesis;
}

/**
 * One candidate explanation: title, description, confidence (with its
 * reasoning), supporting and contradicting evidence shown as clearly
 * separate groups, assumptions, the recommended test and its expected
 * result, and current status. The AI can only ever leave a hypothesis
 * `proposed`; only a human review action can mark one `confirmed-by-human`.
 */
export function HypothesisCard({ hypothesis }: HypothesisCardProps): ReactNode {
  const statusDisplay = getHypothesisStatusDisplay(hypothesis.status);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
          >
            <Typography variant="h6" component="h3">
              {hypothesis.title}
            </Typography>
            <Chip label={`Status: ${statusDisplay.label}`} color={statusDisplay.color} size="small" />
          </Stack>

          <Typography variant="body1">{hypothesis.description}</Typography>

          <ConfidenceIndicator confidence={hypothesis.confidence} />
          <Typography variant="body2" color="text.secondary">
            {hypothesis.confidenceReason}
          </Typography>

          <Divider />

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Supporting evidence</Typography>
            <EvidenceReferenceChips
              evidenceIds={hypothesis.supportingEvidenceIds}
              emptyLabel="No supporting evidence cited."
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Contradicting evidence</Typography>
            <EvidenceReferenceChips
              evidenceIds={hypothesis.contradictingEvidenceIds}
              emptyLabel="No contradicting evidence recorded."
            />
          </Stack>

          {hypothesis.assumptions.length > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Assumptions</Typography>
              <Stack component="ul" sx={{ pl: 2, m: 0 }}>
                {hypothesis.assumptions.map((assumption) => (
                  <Typography key={assumption} component="li" variant="body2">
                    {assumption}
                  </Typography>
                ))}
              </Stack>
            </Stack>
          )}

          <Divider />

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Recommended test</Typography>
            <Typography variant="body2">{hypothesis.recommendedTest}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Expected result</Typography>
            <Typography variant="body2">{hypothesis.expectedResult}</Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
