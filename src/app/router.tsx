import { lazy, Suspense, type ReactNode } from 'react';
import { CircularProgress, Stack, Typography } from '@mui/material';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ROUTES } from '../constants/routes';

const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const NewIncidentPage = lazy(() =>
  import('../pages/NewIncidentPage').then((module) => ({ default: module.NewIncidentPage })),
);
const IncidentWorkspacePage = lazy(() =>
  import('../pages/IncidentWorkspacePage').then((module) => ({
    default: module.IncidentWorkspacePage,
  })),
);

function RouteLoadingFallback(): ReactNode {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <CircularProgress size={18} aria-hidden="true" />
      <Typography role="status" color="text.secondary">
        Loading&hellip;
      </Typography>
    </Stack>
  );
}

/**
 * Top-level route table. Every route renders inside the shared
 * {@link AppShell} layout. Page components (other than the tiny 404 page)
 * are lazy-loaded, so the initial bundle only includes what the first
 * paint actually needs -- each route's code loads on first navigation to it.
 */
export function AppRouter(): ReactNode {
  return (
    <AppShell>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.newIncident} element={<NewIncidentPage />} />
          <Route path={ROUTES.incidentWorkspace} element={<IncidentWorkspacePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
