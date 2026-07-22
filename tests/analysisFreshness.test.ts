import { describe, expect, it } from 'vitest';
import { getAnalysisFreshness, getNewestEvidenceCreatedAt } from '../src/utils/analysisFreshness';
import { buildIncident, buildEvidenceItem } from './helpers/incidentFixture';
import { buildAnalysisRun } from './helpers/analysisRunFixture';

describe('getNewestEvidenceCreatedAt', () => {
  it('returns null when there is no evidence', () => {
    expect(getNewestEvidenceCreatedAt(buildIncident({ evidence: [] }))).toBeNull();
  });

  it('returns the newest createdAt among several evidence items, regardless of array order', () => {
    const incident = buildIncident({
      evidence: [
        buildEvidenceItem({ createdAt: '2026-07-01T00:00:00Z' }),
        buildEvidenceItem({ createdAt: '2026-07-03T00:00:00Z' }),
        buildEvidenceItem({ createdAt: '2026-07-02T00:00:00Z' }),
      ],
    });
    expect(getNewestEvidenceCreatedAt(incident)).toBe('2026-07-03T00:00:00Z');
  });
});

describe('getAnalysisFreshness', () => {
  it('reports "not-analyzed" when no analysis run exists', () => {
    const incident = buildIncident({ evidence: [buildEvidenceItem()], analysisRuns: [] });
    expect(getAnalysisFreshness(incident)).toBe('not-analyzed');
  });

  it('reports "not-analyzed" when only a failed analysis run exists', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem()],
      analysisRuns: [buildAnalysisRun({ status: 'failed' })],
    });
    expect(getAnalysisFreshness(incident)).toBe('not-analyzed');
  });

  it('reports "up-to-date" when evidence predates the latest successful analysis', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem({ createdAt: '2026-07-01T00:00:00Z' })],
      analysisRuns: [buildAnalysisRun({ createdAt: '2026-07-02T00:00:00Z', status: 'completed' })],
    });
    expect(getAnalysisFreshness(incident)).toBe('up-to-date');
  });

  it('reports "up-to-date" when evidence was created at the exact same instant as the analysis', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem({ createdAt: '2026-07-02T00:00:00Z' })],
      analysisRuns: [buildAnalysisRun({ createdAt: '2026-07-02T00:00:00Z', status: 'completed' })],
    });
    expect(getAnalysisFreshness(incident)).toBe('up-to-date');
  });

  it('reports "outdated" when evidence was added after the latest successful analysis', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem({ createdAt: '2026-07-03T00:00:00Z' })],
      analysisRuns: [buildAnalysisRun({ createdAt: '2026-07-02T00:00:00Z', status: 'completed' })],
    });
    expect(getAnalysisFreshness(incident)).toBe('outdated');
  });

  it('uses the latest successful run, ignoring a later failed one', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem({ createdAt: '2026-07-01T12:00:00Z' })],
      analysisRuns: [
        buildAnalysisRun({ id: 'run-1', createdAt: '2026-07-01T00:00:00Z', status: 'completed' }),
        buildAnalysisRun({ id: 'run-2', createdAt: '2026-07-02T00:00:00Z', status: 'failed' }),
      ],
    });
    // The evidence (12:00 on the 1st) is newer than the last *successful* run (midnight on the 1st).
    expect(getAnalysisFreshness(incident)).toBe('outdated');
  });

  it('clears "outdated" once a fresh successful analysis run covers the newer evidence', () => {
    const incident = buildIncident({
      evidence: [buildEvidenceItem({ createdAt: '2026-07-03T00:00:00Z' })],
      analysisRuns: [
        buildAnalysisRun({ id: 'run-1', createdAt: '2026-07-02T00:00:00Z', status: 'completed' }),
        buildAnalysisRun({ id: 'run-2', createdAt: '2026-07-04T00:00:00Z', status: 'completed' }),
      ],
    });
    expect(getAnalysisFreshness(incident)).toBe('up-to-date');
  });
});
