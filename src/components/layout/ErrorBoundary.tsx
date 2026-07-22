import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level React error boundary: catches an unexpected render error
 * anywhere below it and shows a friendly fallback instead of a blank white
 * screen. Must be a class component -- React does not yet support error
 * boundaries via hooks.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Last-resort diagnostic; no telemetry backend exists to report this to instead.
    console.error('Unhandled error in IncidentIQ:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Stack spacing={2} sx={{ p: 4, maxWidth: 640, mx: 'auto' }}>
          <Alert severity="error" variant="outlined">
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              Something went wrong.
            </Typography>
            <Typography variant="body2">
              IncidentIQ hit an unexpected error and could not continue rendering this page. Your
              data has not been lost -- try reloading.
            </Typography>
          </Alert>
          <Button variant="contained" onClick={() => window.location.assign('/')} sx={{ alignSelf: 'flex-start' }}>
            Reload IncidentIQ
          </Button>
        </Stack>
      );
    }

    return this.props.children;
  }
}
