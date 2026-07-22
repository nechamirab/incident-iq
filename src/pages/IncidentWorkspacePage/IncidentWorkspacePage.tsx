import { useEffect, type ReactNode } from 'react';
import { Alert, Box, CircularProgress, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { WORKSPACE_SECTIONS } from '../../constants/workspaceSections';
import { AIReviewSection } from '../../components/workspace/AIReviewSection';
import { EvidenceSection } from '../../components/workspace/EvidenceSection';
import { FactsAssumptionsSection } from '../../components/workspace/FactsAssumptionsSection';
import { HypothesesSection } from '../../components/workspace/HypothesesSection';
import { OverviewSection } from '../../components/workspace/OverviewSection';
import { PlaceholderSection } from '../../components/workspace/PlaceholderSection';
import { ReasoningRisksSection } from '../../components/workspace/ReasoningRisksSection';
import { RecommendedActionsSection } from '../../components/workspace/RecommendedActionsSection';
import { TimelineSection } from '../../components/workspace/TimelineSection';
import { WorkspaceHeader } from '../../components/workspace/WorkspaceHeader';
import { useAnalyzeIncident } from '../../hooks/useAnalyzeIncident';
import { useIncident } from '../../hooks/useIncident';
import { useWorkspaceStore, type WorkspaceSection } from '../../store/workspaceStore';

/**
 * The Incident Workspace: fetches the incident and renders a tabbed
 * layout. Overview, Evidence, Timeline, Hypotheses, Facts & Assumptions,
 * Reasoning Risks, Recommended Actions, and AI Review are fully
 * implemented; the remaining sections show a placeholder naming the stage
 * that introduces them, so the intended navigation is visible end to end.
 */
export function IncidentWorkspacePage(): ReactNode {
  const { incidentId } = useParams<{ incidentId: string }>();
  const incidentQuery = useIncident(incidentId);
  const analyzeMutation = useAnalyzeIncident(incidentId ?? '');

  const activeSection = useWorkspaceStore((state) => state.activeSection);
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);
  const resetForIncident = useWorkspaceStore((state) => state.resetForIncident);

  useEffect(() => {
    resetForIncident();
  }, [incidentId, resetForIncident]);

  if (incidentQuery.isLoading) {
    return (
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <CircularProgress size={18} aria-hidden="true" />
        <Typography role="status" color="text.secondary">
          Loading incident&hellip;
        </Typography>
      </Stack>
    );
  }

  if (incidentQuery.isError) {
    return (
      <Alert severity="error" variant="outlined">
        Could not load this incident: {incidentQuery.error.message}
      </Alert>
    );
  }

  const incident = incidentQuery.data;
  if (!incident) {
    return (
      <Alert severity="warning" variant="outlined">
        No incident was found with id "{incidentId}".
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <WorkspaceHeader
        incident={incident}
        onAnalyze={() => analyzeMutation.mutate()}
        isAnalyzing={analyzeMutation.isPending}
      />

      {analyzeMutation.isError && (
        <Alert severity="error" variant="outlined">
          Analysis failed: {analyzeMutation.error.message}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeSection}
          onChange={(_event, value: WorkspaceSection) => setActiveSection(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Incident workspace sections"
        >
          {WORKSPACE_SECTIONS.map((section) => (
            <Tab key={section.id} value={section.id} label={section.label} id={`workspace-tab-${section.id}`} />
          ))}
        </Tabs>
      </Box>

      <Box role="tabpanel" aria-labelledby={`workspace-tab-${activeSection}`}>
        {activeSection === 'overview' && <OverviewSection incident={incident} />}
        {activeSection === 'evidence' && <EvidenceSection incident={incident} />}
        {activeSection === 'timeline' && <TimelineSection incident={incident} />}
        {activeSection === 'hypotheses' && <HypothesesSection incident={incident} />}
        {activeSection === 'facts-assumptions' && <FactsAssumptionsSection incident={incident} />}
        {activeSection === 'reasoning-risks' && <ReasoningRisksSection incident={incident} />}
        {activeSection === 'actions' && <RecommendedActionsSection incident={incident} />}
        {activeSection === 'ai-review' && <AIReviewSection incident={incident} />}
        {(() => {
          const section = WORKSPACE_SECTIONS.find((candidate) => candidate.id === activeSection);
          return section?.arrivingInStage ? (
            <PlaceholderSection label={section.label} arrivingInStage={section.arrivingInStage} />
          ) : null;
        })()}
      </Box>
    </Stack>
  );
}
