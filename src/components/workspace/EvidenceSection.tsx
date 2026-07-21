import type { ReactNode } from 'react';
import { MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import { EvidenceCard } from '../evidence/EvidenceCard';
import { filterEvidence } from '../../utils/filterEvidence';
import { formatEvidenceSourceType } from '../../utils/formatEvidenceSourceType';
import { getLatestAnalysisRun } from '../../utils/getLatestAnalysisRun';
import {
  buildEvidenceReferenceIndex,
  type EvidenceReference,
} from '../../utils/evidenceReferenceIndex';
import { EVIDENCE_TYPE_FILTER_ALL, useWorkspaceStore } from '../../store/workspaceStore';

interface EvidenceSectionProps {
  incident: Incident;
}

/**
 * The Evidence tab: every piece of evidence attached to the incident,
 * searchable and filterable by source type, each showing which analysis
 * claims (from the latest run, if any) cite it.
 */
export function EvidenceSection({ incident }: EvidenceSectionProps): ReactNode {
  const evidenceSearch = useWorkspaceStore((state) => state.evidenceSearch);
  const setEvidenceSearch = useWorkspaceStore((state) => state.setEvidenceSearch);
  const evidenceTypeFilter = useWorkspaceStore((state) => state.evidenceTypeFilter);
  const setEvidenceTypeFilter = useWorkspaceStore((state) => state.setEvidenceTypeFilter);

  const availableSourceTypes = Array.from(new Set(incident.evidence.map((item) => item.sourceType)));
  const filteredEvidence = filterEvidence(incident.evidence, {
    search: evidenceSearch,
    sourceType: evidenceTypeFilter,
  });

  const latestRun = getLatestAnalysisRun(incident);
  const referenceIndex = latestRun
    ? buildEvidenceReferenceIndex(latestRun)
    : new Map<string, EvidenceReference[]>();

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Search evidence"
          fullWidth
          value={evidenceSearch}
          onChange={(event) => setEvidenceSearch(event.target.value)}
          placeholder="Search by source, content, or evidence id"
        />
        <TextField
          select
          label="Evidence type"
          sx={{ minWidth: { sm: 220 } }}
          value={evidenceTypeFilter}
          onChange={(event) =>
            setEvidenceTypeFilter(event.target.value as typeof evidenceTypeFilter)
          }
        >
          <MenuItem value={EVIDENCE_TYPE_FILTER_ALL}>All types</MenuItem>
          {availableSourceTypes.map((sourceType) => (
            <MenuItem key={sourceType} value={sourceType}>
              {formatEvidenceSourceType(sourceType)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        {filteredEvidence.length} of {incident.evidence.length} evidence item(s)
      </Typography>

      <Stack spacing={1.5}>
        {filteredEvidence.map((item) => (
          <EvidenceCard key={item.id} evidence={item} references={referenceIndex.get(item.id) ?? []} />
        ))}
        {filteredEvidence.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No evidence matches the current search/filter.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
