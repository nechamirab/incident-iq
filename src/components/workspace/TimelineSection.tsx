import type { ReactNode } from 'react';
import { Alert, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import { getLatestAnalysisRun } from '../../utils/getLatestAnalysisRun';
import { sortTimelineEvents } from '../../utils/sortTimelineEvents';
import { getTimestampTypeDisplay } from '../../utils/statusDisplay';
import { EvidenceReferenceChips } from './EvidenceReferenceChips';

interface TimelineSectionProps {
  incident: Incident;
}

/**
 * The Timeline tab: the latest analysis run's events in chronological
 * order, each showing its timestamp, an explicit confidence label for that
 * timestamp (exact/approximate/inferred/unknown), and -- separately, since
 * an event can be inferred even when its type label doesn't make that
 * obvious at a glance -- a clear note when `isInferred` is true.
 */
export function TimelineSection({ incident }: TimelineSectionProps): ReactNode {
  const latestRun = getLatestAnalysisRun(incident);

  if (!latestRun) {
    return (
      <Alert severity="info" variant="outlined">
        No analysis has been run yet. The timeline is reconstructed from evidence once AI analysis
        has been run for this incident.
      </Alert>
    );
  }

  const events = sortTimelineEvents(latestRun.timeline);

  if (events.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        The latest analysis did not identify any timestamped events for this incident.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {events.map((event) => {
        const timestampType = getTimestampTypeDisplay(event.timestampType);
        return (
          <Card key={event.id} variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {event.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(event.timestamp).toLocaleString()}
                    </Typography>
                  </Stack>
                  <Chip label={`Timestamp: ${timestampType.label}`} color={timestampType.color} size="small" />
                </Stack>

                {event.isInferred && (
                  <Alert severity="warning" variant="outlined" sx={{ py: 0 }}>
                    This timestamp was inferred, not confirmed directly by evidence.
                  </Alert>
                )}

                <Typography variant="body2">{event.description}</Typography>

                <Typography variant="body2" color="text.secondary">
                  Confidence: {event.confidence}/100
                </Typography>

                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Evidence
                  </Typography>
                  <EvidenceReferenceChips
                    evidenceIds={event.evidenceIds}
                    emptyLabel="No evidence cited for this event."
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
