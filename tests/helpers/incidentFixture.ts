import type { EvidenceItem } from '../../shared/types/evidence';
import type { Incident } from '../../shared/types/incident';

let evidenceCounter = 0;

/** Builds a minimal, valid EvidenceItem fixture for tests, with overrides. */
export function buildEvidenceItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  evidenceCounter += 1;
  return {
    id: `ev-${evidenceCounter}`,
    incidentId: 'incident-1',
    sourceType: 'application-log',
    sourceName: 'test.log',
    originalContent: 'test content',
    normalizedContent: 'test content',
    timestamp: null,
    lineNumber: null,
    metadata: {},
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

/** Builds a minimal, valid Incident fixture for tests, with overrides. */
export function buildIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'incident-1',
    title: 'Test incident',
    description: 'A test incident.',
    scenarioType: 'custom',
    status: 'draft',
    severity: 'medium',
    affectedService: 'test-service',
    startedAt: null,
    detectedAt: '2026-07-01T00:00:00Z',
    resolvedAt: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    evidence: [],
    analysisRuns: [],
    skepticReviews: [],
    ...overrides,
  };
}
