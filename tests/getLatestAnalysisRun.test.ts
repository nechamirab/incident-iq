import { describe, expect, it } from 'vitest';
import { getLatestAnalysisRun } from '../src/utils/getLatestAnalysisRun';
import { buildIncident } from './helpers/incidentFixture';
import { buildAnalysisRun } from './helpers/analysisRunFixture';

describe('getLatestAnalysisRun', () => {
  it('returns null when there are no analysis runs', () => {
    expect(getLatestAnalysisRun(buildIncident({ analysisRuns: [] }))).toBeNull();
  });

  it('returns the only run when there is one', () => {
    const run = buildAnalysisRun({ id: 'run-only' });
    expect(getLatestAnalysisRun(buildIncident({ analysisRuns: [run] }))?.id).toBe('run-only');
  });

  it('returns the last run when there are several (insertion order)', () => {
    const first = buildAnalysisRun({ id: 'run-first' });
    const second = buildAnalysisRun({ id: 'run-second' });
    const third = buildAnalysisRun({ id: 'run-third' });
    const incident = buildIncident({ analysisRuns: [first, second, third] });
    expect(getLatestAnalysisRun(incident)?.id).toBe('run-third');
  });
});
