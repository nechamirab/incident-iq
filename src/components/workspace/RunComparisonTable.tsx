import type { ReactNode } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { AnalysisRun } from '../../../shared/types/analysisRun';
import { summarizeAnalysisRuns } from '../../utils/summarizeAnalysisRuns';

interface RunComparisonTableProps {
  runs: readonly AnalysisRun[];
}

/**
 * Compares every analysis run performed on an incident so far, so a
 * reviewer can see how hypotheses and confidence evolved across re-runs.
 */
export function RunComparisonTable({ runs }: RunComparisonTableProps): ReactNode {
  if (runs.length < 2) {
    return (
      <Typography variant="body2" color="text.secondary">
        Only one analysis run exists for this incident. Run analysis again to compare results
        across runs.
      </Typography>
    );
  }

  const rows = summarizeAnalysisRuns(runs);

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Run</TableCell>
            <TableCell>Analyzed</TableCell>
            <TableCell>Provider</TableCell>
            <TableCell>Model</TableCell>
            <TableCell>Prompt version</TableCell>
            <TableCell align="right">Hypotheses</TableCell>
            <TableCell align="right">Top confidence</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.id}>
              <TableCell>#{index + 1}</TableCell>
              <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
              <TableCell>{row.provider}</TableCell>
              <TableCell>{row.model}</TableCell>
              <TableCell>{row.promptVersion}</TableCell>
              <TableCell align="right">{row.hypothesisCount}</TableCell>
              <TableCell align="right">{row.topConfidence ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
