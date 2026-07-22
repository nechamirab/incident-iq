import type { ReactNode } from 'react';
import { ErrorBoundary } from '../components/layout/ErrorBoundary';
import { AppProviders } from './providers';
import { AppRouter } from './router';

/**
 * Application root: infrastructure providers wrapping the route table,
 * with a top-level error boundary so an unexpected render error anywhere
 * shows a friendly fallback instead of a blank white screen.
 */
export function App(): ReactNode {
  return (
    <AppProviders>
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </AppProviders>
  );
}
