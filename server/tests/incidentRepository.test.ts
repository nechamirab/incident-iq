import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import type { CreateIncidentInput } from '../../shared/types/incident.js';
import type { AnalysisRun } from '../../shared/types/analysisRun.js';
import type { EvidenceItem } from '../../shared/types/evidence.js';

function buildCreateInput(overrides: Partial<CreateIncidentInput> = {}): CreateIncidentInput {
  return {
    title: 'Test incident',
    description: 'A test incident used for repository unit tests.',
    severity: 'medium',
    affectedService: 'test-service',
    detectedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('InMemoryIncidentRepository', () => {
  let repository: InMemoryIncidentRepository;

  beforeEach(() => {
    repository = new InMemoryIncidentRepository(sampleIncidents);
  });

  it('returns every seeded incident from findAll', async () => {
    const incidents = await repository.findAll();
    expect(incidents).toHaveLength(sampleIncidents.length);
  });

  it('findAll returns clones, not live references', async () => {
    const [first] = await repository.findAll();
    first.title = 'Mutated title';

    const [second] = await repository.findAll();
    expect(second.title).not.toBe('Mutated title');
  });

  it('finds a seeded incident by id', async () => {
    const incident = await repository.findById(sampleIncidents[0].id);
    expect(incident?.id).toBe(sampleIncidents[0].id);
  });

  it('returns null when finding a missing incident', async () => {
    const incident = await repository.findById('does-not-exist');
    expect(incident).toBeNull();
  });

  it('creates a new incident with generated id and system-managed defaults', async () => {
    const before = await repository.findAll();
    const created = await repository.create(buildCreateInput());

    expect(created.id).toBeTruthy();
    expect(created.status).toBe('draft');
    expect(created.scenarioType).toBe('custom');
    expect(created.evidence).toEqual([]);
    expect(created.analysisRuns).toEqual([]);
    expect(created.createdAt).toBe(created.updatedAt);

    const after = await repository.findAll();
    expect(after).toHaveLength(before.length + 1);
  });

  it('honors an explicit scenarioType on create', async () => {
    const created = await repository.create(
      buildCreateInput({ scenarioType: 'ecommerce-checkout' }),
    );
    expect(created.scenarioType).toBe('ecommerce-checkout');
  });

  it('updates fields on an existing incident and bumps updatedAt', async () => {
    vi.useFakeTimers();
    try {
      const created = await repository.create(buildCreateInput());
      vi.advanceTimersByTime(1000);
      const updated = await repository.update(created.id, { title: 'Updated title' });

      expect(updated?.title).toBe('Updated title');
      expect(updated?.updatedAt).not.toBe(created.updatedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null when updating a missing incident', async () => {
    const updated = await repository.update('does-not-exist', { title: 'x' });
    expect(updated).toBeNull();
  });

  it('deletes an existing incident and reports success', async () => {
    const created = await repository.create(buildCreateInput());
    const deleted = await repository.delete(created.id);
    expect(deleted).toBe(true);

    const after = await repository.findById(created.id);
    expect(after).toBeNull();
  });

  it('reports failure when deleting a missing incident', async () => {
    const deleted = await repository.delete('does-not-exist');
    expect(deleted).toBe(false);
  });

  it('appends evidence to an incident', async () => {
    const created = await repository.create(buildCreateInput());
    const newEvidence: EvidenceItem[] = [
      {
        id: 'ev-new-1',
        incidentId: created.id,
        sourceType: 'application-log',
        sourceName: 'test.log',
        originalContent: 'test log line',
        normalizedContent: 'test log line',
        timestamp: '2026-07-01T00:05:00Z',
        lineNumber: 1,
        metadata: {},
        createdAt: '2026-07-01T00:05:00Z',
      },
    ];

    const updated = await repository.addEvidence(created.id, newEvidence);
    expect(updated?.evidence).toHaveLength(1);
    expect(updated?.evidence[0]?.id).toBe('ev-new-1');
  });

  it('returns null when adding evidence to a missing incident', async () => {
    const updated = await repository.addEvidence('does-not-exist', []);
    expect(updated).toBeNull();
  });

  it('appends an analysis run to an incident', async () => {
    const created = await repository.create(buildCreateInput());
    const run: AnalysisRun = {
      id: 'run-new-1',
      incidentId: created.id,
      provider: 'mock',
      model: 'mock-v1',
      promptVersion: 'incident-analysis-v1',
      createdAt: '2026-07-01T00:10:00Z',
      inputHash: 'hash-1',
      durationMs: 500,
      status: 'completed',
      summary: { text: 'Summary', affectedComponents: [], impact: 'Unknown' },
      timeline: [],
      facts: [],
      assumptions: [],
      hypotheses: [],
      reasoningRisks: [],
      recommendedActions: [],
      openQuestions: [],
      unsupportedClaims: [],
      validationWarnings: [],
      rawResponse: null,
    };

    const updated = await repository.addAnalysisRun(created.id, run);
    expect(updated?.analysisRuns).toHaveLength(1);
    expect(updated?.analysisRuns[0]?.id).toBe('run-new-1');
  });

  it('returns null when adding an analysis run to a missing incident', async () => {
    const run: AnalysisRun = {
      id: 'run-new-2',
      incidentId: 'does-not-exist',
      provider: 'mock',
      model: 'mock-v1',
      promptVersion: 'incident-analysis-v1',
      createdAt: '2026-07-01T00:10:00Z',
      inputHash: 'hash-2',
      durationMs: 500,
      status: 'completed',
      summary: { text: 'Summary', affectedComponents: [], impact: 'Unknown' },
      timeline: [],
      facts: [],
      assumptions: [],
      hypotheses: [],
      reasoningRisks: [],
      recommendedActions: [],
      openQuestions: [],
      unsupportedClaims: [],
      validationWarnings: [],
      rawResponse: null,
    };

    const updated = await repository.addAnalysisRun('does-not-exist', run);
    expect(updated).toBeNull();
  });
});
