import { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '../theme/theme';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Wires up all cross-cutting infrastructure providers (theming, routing,
 * and server-state caching). This is the only place React Context is used
 * directly — application/business state uses Zustand instead, from Stage 3
 * onward.
 */
export function AppProviders({ children }: AppProvidersProps): ReactNode {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>{children}</BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
