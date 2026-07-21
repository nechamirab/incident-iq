import type { ReactNode } from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import { useWorkspaceStore } from '../../store/workspaceStore';

interface EvidenceReferenceChipsProps {
  evidenceIds: readonly string[];
  emptyLabel: string;
}

/**
 * Renders a row of evidence-id chips; clicking one jumps to the Evidence
 * tab with that id pre-filled into the search box, so a cited evidence
 * item is always one click away from any claim that references it.
 */
export function EvidenceReferenceChips({ evidenceIds, emptyLabel }: EvidenceReferenceChipsProps): ReactNode {
  const setEvidenceSearch = useWorkspaceStore((state) => state.setEvidenceSearch);
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);

  function goToEvidence(evidenceId: string): void {
    setEvidenceSearch(evidenceId);
    setActiveSection('evidence');
  }

  if (evidenceIds.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyLabel}
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      {evidenceIds.map((evidenceId) => (
        <Chip
          key={evidenceId}
          label={evidenceId}
          size="small"
          variant="outlined"
          clickable
          onClick={() => goToEvidence(evidenceId)}
        />
      ))}
    </Stack>
  );
}
