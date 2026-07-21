import { beforeEach, describe, expect, it } from 'vitest';
import { EVIDENCE_TYPE_FILTER_ALL, useWorkspaceStore } from '../src/store/workspaceStore';

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().resetForIncident();
  });

  it('defaults to the overview section', () => {
    expect(useWorkspaceStore.getState().activeSection).toBe('overview');
  });

  it('defaults to no search and no type filter', () => {
    const state = useWorkspaceStore.getState();
    expect(state.evidenceSearch).toBe('');
    expect(state.evidenceTypeFilter).toBe(EVIDENCE_TYPE_FILTER_ALL);
  });

  it('changes the active section', () => {
    useWorkspaceStore.getState().setActiveSection('evidence');
    expect(useWorkspaceStore.getState().activeSection).toBe('evidence');
  });

  it('updates the evidence search text', () => {
    useWorkspaceStore.getState().setEvidenceSearch('timeout');
    expect(useWorkspaceStore.getState().evidenceSearch).toBe('timeout');
  });

  it('updates the evidence type filter', () => {
    useWorkspaceStore.getState().setEvidenceTypeFilter('database-error');
    expect(useWorkspaceStore.getState().evidenceTypeFilter).toBe('database-error');
  });

  it('resetForIncident clears search, filter, and returns to overview', () => {
    const store = useWorkspaceStore.getState();
    store.setActiveSection('facts-assumptions');
    store.setEvidenceSearch('timeout');
    store.setEvidenceTypeFilter('database-error');

    useWorkspaceStore.getState().resetForIncident();

    const state = useWorkspaceStore.getState();
    expect(state.activeSection).toBe('overview');
    expect(state.evidenceSearch).toBe('');
    expect(state.evidenceTypeFilter).toBe(EVIDENCE_TYPE_FILTER_ALL);
  });
});
