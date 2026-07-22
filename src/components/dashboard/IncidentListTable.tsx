import type { ReactNode } from 'react';
import {
  Chip,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import type { Incident } from '../../../shared/types/incident';
import { buildIncidentWorkspacePath } from '../../constants/routes';
import { getIncidentStatusDisplay, getSeverityDisplay } from '../../utils/statusDisplay';

interface IncidentListTableProps {
  incidents: readonly Incident[];
}

/**
 * The Dashboard's incident list: every incident's key metadata, sorted and
 * filtered by the caller. Each row navigates to that incident's workspace
 * -- the title itself is a real link (so it works from the keyboard and
 * for screen readers), and clicking anywhere else in the row is a mouse
 * convenience that does the same thing.
 */
export function IncidentListTable({ incidents }: IncidentListTableProps): ReactNode {
  const navigate = useNavigate();

  if (incidents.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No incidents match the current search/filter.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Severity</TableCell>
            <TableCell>Affected service</TableCell>
            <TableCell>Detected</TableCell>
            <TableCell>Updated</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {incidents.map((incident) => {
            const status = getIncidentStatusDisplay(incident.status);
            const severity = getSeverityDisplay(incident.severity);
            const path = buildIncidentWorkspacePath(incident.id);

            return (
              <TableRow
                key={incident.id}
                hover
                onClick={() => {
                  void navigate(path);
                }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>
                  <Link component={RouterLink} to={path} underline="hover" color="inherit">
                    {incident.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Chip label={status.label} color={status.color} size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={severity.label} color={severity.color} size="small" />
                </TableCell>
                <TableCell>{incident.affectedService}</TableCell>
                <TableCell>{new Date(incident.detectedAt).toLocaleString()}</TableCell>
                <TableCell>{new Date(incident.updatedAt).toLocaleString()}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
