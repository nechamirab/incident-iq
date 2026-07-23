import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import type { CreateIncidentInput } from '../../shared/types/incident.js';
import type { AnalysisRun } from '../../shared/types/analysisRun.js';
import type { EvidenceItem } from '../../shared/types/evidence.js';
import type { Postmortem } from '../../shared/types/postmortem.js';
import type { SkepticReview } from '../../shared/types/skepticReview.js';
import { buildAnalysisRun } from './helpers/analysisRunFixture.js';

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
      uncertaintyStatement: 'This is a test fixture with known limitations.',
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
      uncertaintyStatement: 'This is a test fixture with known limitations.',
      validationWarnings: [],
      rawResponse: null,
    };

    const updated = await repository.addAnalysisRun('does-not-exist', run);
    expect(updated).toBeNull();
  });

  describe('addSkepticReview / updateSkepticReviewNotes', () => {
    function buildReview(overrides: Partial<SkepticReview> = {}): SkepticReview {
      return {
        id: 'review-1',
        incidentId: 'incident-review',
        analysisRunId: 'run-1',
        provider: 'mock',
        model: 'mock-v1',
        promptVersion: 'skeptic-review-v1',
        createdAt: '2026-07-01T00:15:00Z',
        durationMs: 5,
        challengedHypothesisId: 'hypothesis-1',
        challengeSummary: 'A challenge summary.',
        alternativeExplanations: [],
        ignoredEvidenceIds: [],
        confirmationBiasAssessment: 'An assessment.',
        falsificationTest: 'A falsification test.',
        recommendedTests: [],
        overallAssessment: 'An overall assessment.',
        humanNotes: null,
        rawResponse: null,
        ...overrides,
      };
    }

    it('appends a skeptic review to an incident', async () => {
      const created = await repository.create(buildCreateInput());
      const updated = await repository.addSkepticReview(created.id, {
        ...buildReview(),
        incidentId: created.id,
      });

      expect(updated?.skepticReviews).toHaveLength(1);
      expect(updated?.skepticReviews[0]?.id).toBe('review-1');
    });

    it('returns null when adding a skeptic review to a missing incident', async () => {
      const updated = await repository.addSkepticReview('does-not-exist', buildReview());
      expect(updated).toBeNull();
    });

    it("updates a skeptic review's human notes", async () => {
      const created = await repository.create(buildCreateInput());
      await repository.addSkepticReview(created.id, { ...buildReview(), incidentId: created.id });

      const updated = await repository.updateSkepticReviewNotes(created.id, 'review-1', 'My notes.');
      expect(updated?.skepticReviews[0]?.humanNotes).toBe('My notes.');
    });

    it('returns null for a missing incident', async () => {
      const updated = await repository.updateSkepticReviewNotes('does-not-exist', 'review-1', 'x');
      expect(updated).toBeNull();
    });

    it('returns null for a missing skeptic review id', async () => {
      const created = await repository.create(buildCreateInput());
      await repository.addSkepticReview(created.id, { ...buildReview(), incidentId: created.id });

      const updated = await repository.updateSkepticReviewNotes(created.id, 'does-not-exist', 'x');
      expect(updated).toBeNull();
    });

    it('bumps updatedAt on success', async () => {
      const created = await repository.create(buildCreateInput());
      await repository.addSkepticReview(created.id, { ...buildReview(), incidentId: created.id });

      vi.useFakeTimers();
      try {
        vi.advanceTimersByTime(1000);
        const updated = await repository.updateSkepticReviewNotes(created.id, 'review-1', 'x');
        expect(updated?.updatedAt).not.toBe(created.updatedAt);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('setPostmortem', () => {
    function buildPostmortem(overrides: Partial<Postmortem> = {}): Postmortem {
      return {
        incidentSummary: 'A summary.',
        impact: 'Some impact.',
        detection: 'Detected somehow.',
        timeline: 'A short timeline.',
        contributingFactors: [],
        hypothesesInvestigated: [],
        likelyCause: 'A likely cause.',
        uncertaintyStatement: 'Not confirmed.',
        resolution: 'Not yet resolved.',
        correctiveActions: [],
        lessonsLearned: [],
        followUpItems: [],
        provider: 'mock',
        model: 'mock-deterministic-v1',
        promptVersion: 'postmortem-v1',
        generatedAt: '2026-07-01T00:20:00Z',
        lastEditedAt: null,
        ...overrides,
      };
    }

    it('sets the postmortem on an incident that had none', async () => {
      const created = await repository.create(buildCreateInput());
      const updated = await repository.setPostmortem(created.id, buildPostmortem());

      expect(updated?.postmortem?.incidentSummary).toBe('A summary.');
    });

    it('fully replaces an existing postmortem, not merges it', async () => {
      const created = await repository.create(buildCreateInput());
      await repository.setPostmortem(created.id, buildPostmortem({ incidentSummary: 'First draft.' }));
      const updated = await repository.setPostmortem(
        created.id,
        buildPostmortem({ incidentSummary: 'Second draft.', impact: 'New impact.' }),
      );

      expect(updated?.postmortem?.incidentSummary).toBe('Second draft.');
      expect(updated?.postmortem?.impact).toBe('New impact.');
    });

    it('returns null for a missing incident', async () => {
      const updated = await repository.setPostmortem('does-not-exist', buildPostmortem());
      expect(updated).toBeNull();
    });

    it('bumps updatedAt on success', async () => {
      const created = await repository.create(buildCreateInput());

      vi.useFakeTimers();
      try {
        vi.advanceTimersByTime(1000);
        const updated = await repository.setPostmortem(created.id, buildPostmortem());
        expect(updated?.updatedAt).not.toBe(created.updatedAt);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('updateStatementReviewStatus', () => {
    function buildRunWithStatements(): AnalysisRun {
      return {
        id: 'run-review-1',
        incidentId: 'incident-review',
        provider: 'mock',
        model: 'mock-v1',
        promptVersion: 'incident-analysis-v1',
        createdAt: '2026-07-01T00:10:00Z',
        inputHash: 'hash-review',
        durationMs: 10,
        status: 'completed',
        summary: { text: 'Summary', affectedComponents: [], impact: 'Unknown' },
        timeline: [],
        facts: [
          {
            id: 'fact-1',
            category: 'fact',
            statement: 'checkout-api returned 500 errors.',
            explanation: 'Observed directly.',
            evidenceIds: ['ev-1'],
            confidence: 80,
            reviewStatus: 'unreviewed',
          },
        ],
        assumptions: [
          {
            id: 'assumption-1',
            category: 'assumption',
            statement: 'Maybe related to the deploy.',
            explanation: 'Speculative.',
            evidenceIds: [],
            confidence: 30,
            reviewStatus: 'unreviewed',
          },
        ],
        hypotheses: [],
        reasoningRisks: [],
        recommendedActions: [],
        openQuestions: [],
        unsupportedClaims: [],
        uncertaintyStatement: 'This is a test fixture with known limitations.',
        validationWarnings: [],
        rawResponse: null,
      };
    }

    it('updates a fact\'s review status', async () => {
      const created = await repository.create(buildCreateInput());
      await repository.addAnalysisRun(created.id, { ...buildRunWithStatements(), incidentId: created.id });

      const updated = await repository.updateStatementReviewStatus(created.id, 'fact-1', 'supported');
      expect(updated?.analysisRuns[0]?.facts[0]?.reviewStatus).toBe('supported');
    });

    it('updates an assumption\'s review status without touching facts', async () => {
      const created = await repository.create(buildCreateInput());
      await repository.addAnalysisRun(created.id, { ...buildRunWithStatements(), incidentId: created.id });

      const updated = await repository.updateStatementReviewStatus(
        created.id,
        'assumption-1',
        'rejected',
      );
      expect(updated?.analysisRuns[0]?.assumptions[0]?.reviewStatus).toBe('rejected');
      expect(updated?.analysisRuns[0]?.facts[0]?.reviewStatus).toBe('unreviewed');
    });

    it('returns null for a missing incident', async () => {
      const updated = await repository.updateStatementReviewStatus('does-not-exist', 'fact-1', 'supported');
      expect(updated).toBeNull();
    });

    it('returns null for a missing statement id', async () => {
      const created = await repository.create(buildCreateInput());
      await repository.addAnalysisRun(created.id, { ...buildRunWithStatements(), incidentId: created.id });

      const updated = await repository.updateStatementReviewStatus(
        created.id,
        'does-not-exist',
        'supported',
      );
      expect(updated).toBeNull();
    });

    it('bumps updatedAt on success', async () => {
      const created = await repository.create(buildCreateInput());
      await repository.addAnalysisRun(created.id, { ...buildRunWithStatements(), incidentId: created.id });

      vi.useFakeTimers();
      try {
        vi.advanceTimersByTime(1000);
        const updated = await repository.updateStatementReviewStatus(created.id, 'fact-1', 'supported');
        expect(updated?.updatedAt).not.toBe(created.updatedAt);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('updateHypothesisStatus', () => {
    it('updates the status, recording previousStatus, reviewedAt, and the note', async () => {
      const incident = sampleIncidents[0];
      const run = buildAnalysisRun(incident, incident.evidence[0].id);
      await repository.addAnalysisRun(incident.id, run);
      const hypothesisId = run.hypotheses[0].id;

      const updated = await repository.updateHypothesisStatus(
        incident.id,
        hypothesisId,
        'confirmed-by-human',
        'Confirmed via server logs.',
      );

      const hypothesis = updated?.analysisRuns[0]?.hypotheses.find((h) => h.id === hypothesisId);
      expect(hypothesis?.status).toBe('confirmed-by-human');
      expect(hypothesis?.previousStatus).toBe('proposed');
      expect(hypothesis?.humanReviewNote).toBe('Confirmed via server logs.');
      expect(Number.isNaN(Date.parse(hypothesis?.reviewedAt ?? ''))).toBe(false);
    });

    it('allows a null review note', async () => {
      const incident = sampleIncidents[0];
      const run = buildAnalysisRun(incident, incident.evidence[0].id);
      await repository.addAnalysisRun(incident.id, run);
      const hypothesisId = run.hypotheses[0].id;

      const updated = await repository.updateHypothesisStatus(incident.id, hypothesisId, 'testing', null);
      const hypothesis = updated?.analysisRuns[0]?.hypotheses.find((h) => h.id === hypothesisId);
      expect(hypothesis?.humanReviewNote).toBeNull();
    });

    it('does not affect any other hypothesis on the same run', async () => {
      const incident = sampleIncidents[0];
      const run = buildAnalysisRun(incident, incident.evidence[0].id);
      await repository.addAnalysisRun(incident.id, run);
      const [targetId, untouchedId] = run.hypotheses.map((h) => h.id);

      const updated = await repository.updateHypothesisStatus(incident.id, targetId, 'rejected', null);
      const untouched = updated?.analysisRuns[0]?.hypotheses.find((h) => h.id === untouchedId);
      expect(untouched?.status).toBe('proposed');
      expect(untouched?.reviewedAt).toBeFalsy();
    });

    it('returns null for a missing incident', async () => {
      const updated = await repository.updateHypothesisStatus('does-not-exist', 'hyp-1', 'testing', null);
      expect(updated).toBeNull();
    });

    it('returns null for a missing hypothesis id', async () => {
      const incident = sampleIncidents[0];
      const run = buildAnalysisRun(incident, incident.evidence[0].id);
      await repository.addAnalysisRun(incident.id, run);

      const updated = await repository.updateHypothesisStatus(incident.id, 'does-not-exist', 'testing', null);
      expect(updated).toBeNull();
    });

    it('bumps updatedAt on success', async () => {
      const incident = sampleIncidents[0];
      const run = buildAnalysisRun(incident, incident.evidence[0].id);
      const created = await repository.addAnalysisRun(incident.id, run);

      vi.useFakeTimers();
      try {
        vi.advanceTimersByTime(1000);
        const updated = await repository.updateHypothesisStatus(incident.id, run.hypotheses[0].id, 'testing', null);
        expect(updated?.updatedAt).not.toBe(created?.updatedAt);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
