import type { ReactNode } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

/**
 * Displayed for any route that does not match a known page.
 */
export function NotFoundPage(): ReactNode {
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="h4" component="h1">
        Page not found
      </Typography>
      <Typography variant="body1" color="text.secondary">
        The page you are looking for does not exist or may have been moved.
      </Typography>
      <Button component={RouterLink} to={ROUTES.dashboard} variant="contained">
        Return to Dashboard
      </Button>
    </Stack>
  );
}
