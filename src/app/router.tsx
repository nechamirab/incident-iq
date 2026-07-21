import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPage } from '../pages/DashboardPage';
import { NewIncidentPage } from '../pages/NewIncidentPage';
import { IncidentWorkspacePage } from '../pages/IncidentWorkspacePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ROUTES } from '../constants/routes';

/**
 * Top-level route table. Every route renders inside the shared
 * {@link AppShell} layout.
 */
export function AppRouter(): ReactNode {
  return (
    <AppShell>
      <Routes>
        <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        <Route path={ROUTES.newIncident} element={<NewIncidentPage />} />
        <Route path={ROUTES.incidentWorkspace} element={<IncidentWorkspacePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
