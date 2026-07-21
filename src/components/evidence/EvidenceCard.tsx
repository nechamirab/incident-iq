import { useState, type ReactNode } from 'react';
import { Box, Chip, Collapse, IconButton, Paper, Stack, Typography } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { EvidenceItem } from '../../../shared/types/evidence';
import { CopyButton } from '../common/CopyButton';
import { formatEvidenceSourceType } from '../../utils/formatEvidenceSourceType';
import {
  summarizeEvidenceReferences,
  type EvidenceReference,
} from '../../utils/evidenceReferenceIndex';

interface EvidenceCardProps {
  evidence: EvidenceItem;
  references: EvidenceReference[];
}

/**
 * One evidence item: id, source type/name, timestamp, and its content
 * (original and normalized shown separately, since they can differ),
 * expandable/collapsible, with a copy action and a summary of which
 * analysis claims cite it.
 */
export function EvidenceCard({ evidence, references }: EvidenceCardProps): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentDiffers = evidence.originalContent !== evidence.normalizedContent;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Chip
            label={formatEvidenceSourceType(evidence.sourceType)}
            size="small"
            variant="outlined"
          />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {evidence.sourceName}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              ID: {evidence.id}
              {evidence.timestamp ? ` · ${new Date(evidence.timestamp).toLocaleString()}` : ' · no timestamp'}
              {evidence.lineNumber !== null ? ` · line ${evidence.lineNumber}` : ''}
            </Typography>
          </Box>
          <CopyButton value={evidence.normalizedContent} label="evidence content" />
          <IconButton
            size="small"
            aria-label={isExpanded ? 'Collapse evidence' : 'Expand evidence'}
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {evidence.normalizedContent}
        </Typography>

        {references.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            Referenced by {summarizeEvidenceReferences(references)}
          </Typography>
        )}

        <Collapse in={isExpanded}>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {contentDiffers && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Original content
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1.5,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    fontSize: 12,
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {evidence.originalContent}
                </Box>
              </Box>
            )}
            {Object.keys(evidence.metadata).length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Metadata
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1.5,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    fontSize: 12,
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(evidence.metadata, null, 2)}
                </Box>
              </Box>
            )}
            {references.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Cited by
                </Typography>
                <Stack component="ul" sx={{ pl: 2, m: 0 }}>
                  {references.map((reference, index) => (
                    <Typography
                      key={`${reference.type}-${reference.label}-${index}`}
                      component="li"
                      variant="body2"
                    >
                      {reference.label}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
