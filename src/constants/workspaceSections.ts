import type { WorkspaceSection } from '../store/workspaceStore';

export interface WorkspaceSectionConfig {
  id: WorkspaceSection;
  label: string;
}

/** The full set of Incident Workspace tabs, in display order. */
export const WORKSPACE_SECTIONS: readonly WorkspaceSectionConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'hypotheses', label: 'Hypotheses' },
  { id: 'facts-assumptions', label: 'Facts & Assumptions' },
  { id: 'reasoning-risks', label: 'Reasoning Risks' },
  { id: 'actions', label: 'Recommended Actions' },
  { id: 'ai-review', label: 'AI Review' },
  { id: 'postmortem', label: 'Postmortem' },
] as const;
