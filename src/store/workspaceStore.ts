import { create } from 'zustand';
import type { EvidenceSourceType } from '../../shared/types/evidence';

/**
 * Identifies each section of the Incident Workspace's tabbed layout.
 * Sections without a Stage 5 implementation still appear as tabs (with a
 * "not built yet" placeholder) so the full intended navigation is visible.
 */
export type WorkspaceSection =
  | 'overview'
  | 'evidence'
  | 'timeline'
  | 'hypotheses'
  | 'facts-assumptions'
  | 'reasoning-risks'
  | 'actions'
  | 'ai-review'
  | 'postmortem';

export const EVIDENCE_TYPE_FILTER_ALL = 'all' as const;
export type EvidenceTypeFilter = EvidenceSourceType | typeof EVIDENCE_TYPE_FILTER_ALL;

interface WorkspaceUIState {
  activeSection: WorkspaceSection;
  setActiveSection: (section: WorkspaceSection) => void;

  evidenceSearch: string;
  setEvidenceSearch: (value: string) => void;

  evidenceTypeFilter: EvidenceTypeFilter;
  setEvidenceTypeFilter: (value: EvidenceTypeFilter) => void;

  /** Resets per-incident UI state (filters, active section) when the user navigates to a different incident. */
  resetForIncident: () => void;
}

/**
 * Client-side UI state for the Incident Workspace: which tab is active and
 * the current evidence search/filter. Deliberately excludes anything that
 * is (or is derived from) server data -- that all lives in TanStack Query
 * -- per the project's rule that Zustand holds UI state only.
 */
export const useWorkspaceStore = create<WorkspaceUIState>((set) => ({
  activeSection: 'overview',
  setActiveSection: (section) => set({ activeSection: section }),

  evidenceSearch: '',
  setEvidenceSearch: (value) => set({ evidenceSearch: value }),

  evidenceTypeFilter: EVIDENCE_TYPE_FILTER_ALL,
  setEvidenceTypeFilter: (value) => set({ evidenceTypeFilter: value }),

  resetForIncident: () =>
    set({
      activeSection: 'overview',
      evidenceSearch: '',
      evidenceTypeFilter: EVIDENCE_TYPE_FILTER_ALL,
    }),
}));
