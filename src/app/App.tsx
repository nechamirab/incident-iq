import type { ReactNode } from 'react';
import { AppProviders } from './providers';
import { AppRouter } from './router';

/**
 * Application root: infrastructure providers wrapping the route table.
 */
export function App(): ReactNode {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
