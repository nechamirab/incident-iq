import { describe, expect, it } from 'vitest';
import { filterEvidence } from '../src/utils/filterEvidence';
import { EVIDENCE_TYPE_FILTER_ALL } from '../src/store/workspaceStore';
import { buildEvidenceItem } from './helpers/incidentFixture';

describe('filterEvidence', () => {
  const logItem = buildEvidenceItem({
    id: 'ev-log',
    sourceType: 'application-log',
    sourceName: 'checkout-api.log',
    normalizedContent: 'DB connection timeout after 5000ms',
  });
  const alertItem = buildEvidenceItem({
    id: 'ev-alert',
    sourceType: 'monitoring-alert',
    sourceName: 'Datadog',
    normalizedContent: 'error rate exceeded threshold',
  });
  const evidence = [logItem, alertItem];

  it('returns everything when search is empty and filter is "all"', () => {
    const result = filterEvidence(evidence, { search: '', sourceType: EVIDENCE_TYPE_FILTER_ALL });
    expect(result).toHaveLength(2);
  });

  it('filters by source type', () => {
    const result = filterEvidence(evidence, { search: '', sourceType: 'monitoring-alert' });
    expect(result).toEqual([alertItem]);
  });

  it('matches search text against normalized content, case-insensitively', () => {
    const result = filterEvidence(evidence, { search: 'TIMEOUT', sourceType: EVIDENCE_TYPE_FILTER_ALL });
    expect(result).toEqual([logItem]);
  });

  it('matches search text against source name', () => {
    const result = filterEvidence(evidence, { search: 'datadog', sourceType: EVIDENCE_TYPE_FILTER_ALL });
    expect(result).toEqual([alertItem]);
  });

  it('matches search text against evidence id', () => {
    const result = filterEvidence(evidence, { search: 'ev-log', sourceType: EVIDENCE_TYPE_FILTER_ALL });
    expect(result).toEqual([logItem]);
  });

  it('combines search and type filter (AND, not OR)', () => {
    const result = filterEvidence(evidence, { search: 'timeout', sourceType: 'monitoring-alert' });
    expect(result).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    const result = filterEvidence(evidence, { search: 'nonexistent', sourceType: EVIDENCE_TYPE_FILTER_ALL });
    expect(result).toEqual([]);
  });
});
