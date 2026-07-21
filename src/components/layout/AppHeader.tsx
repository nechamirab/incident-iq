import type { ReactNode } from 'react';
import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

const NAV_ITEMS = [
  { label: 'Dashboard', path: ROUTES.dashboard },
  { label: 'New Incident', path: ROUTES.newIncident },
] as const;

/**
 * Top application bar: brand mark and primary navigation.
 */
export function AppHeader(): ReactNode {
  return (
    <AppBar position="sticky" color="inherit" sx={{ bgcolor: 'background.default' }}>
      <Toolbar sx={{ gap: 3 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>
          IncidentIQ
        </Typography>
        <Box component="nav" aria-label="Primary" sx={{ display: 'flex', gap: 1 }}>
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.path}
              component={NavLink}
              to={item.path}
              end={item.path === ROUTES.dashboard}
              color="inherit"
              sx={{
                color: 'text.secondary',
                '&.active': {
                  color: 'primary.main',
                  fontWeight: 700,
                },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
