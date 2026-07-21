import type { WorkspaceSection } from '../store/workspaceStore';

export interface WorkspaceSectionConfig {
  id: WorkspaceSection;
  label: string;
  /** `null` for sections implemented in this stage. */
  arrivingInStage: number | null;
}

/**
 * The full intended set of Incident Workspace tabs, in display order.
 * Sections not yet implemented still appear (per the project's "professional
 * workspace layout with clear navigation" requirement) but render a
 * placeholder naming the stage that introduces them, rather than being
 * hidden entirely.
 */
export const WORKSPACE_SECTIONS: readonly WorkspaceSectionConfig[] = [
  { id: 'overview', label: 'Overview', arrivingInStage: null },
  { id: 'evidence', label: 'Evidence', arrivingInStage: null },
  { id: 'timeline', label: 'Timeline', arrivingInStage: null },
  { id: 'hypotheses', label: 'Hypotheses', arrivingInStage: null },
  { id: 'facts-assumptions', label: 'Facts & Assumptions', arrivingInStage: null },
  { id: 'reasoning-risks', label: 'Reasoning Risks', arrivingInStage: 7 },
  { id: 'actions', label: 'Recommended Actions', arrivingInStage: 7 },
  { id: 'ai-review', label: 'AI Review', arrivingInStage: 8 },
  { id: 'postmortem', label: 'Postmortem', arrivingInStage: 9 },
] as const;
