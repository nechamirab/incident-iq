import type { ReactNode } from 'react';
import { Box, Container } from '@mui/material';
import { AppHeader } from './AppHeader';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Application-wide layout: sticky header plus a constrained, responsive
 * content area shared by every route.
 */
export function AppShell({ children }: AppShellProps): ReactNode {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader />
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, sm: 4 } }}>
        {children}
      </Container>
    </Box>
  );
}
