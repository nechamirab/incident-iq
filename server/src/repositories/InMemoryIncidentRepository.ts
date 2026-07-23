import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { EvidenceItem } from '../../../shared/types/evidence.js';
import type { HypothesisStatus } from '../../../shared/types/hypothesis.js';
import type {
  CreateIncidentInput,
  Incident,
  UpdateIncidentInput,
} from '../../../shared/types/incident.js';
import type { Postmortem } from '../../../shared/types/postmortem.js';
import type { ReviewStatus } from '../../../shared/types/reasoning.js';
import type { SkepticReview } from '../../../shared/types/skepticReview.js';
import { createId } from '../utils/id.js';
import type { IncidentRepository } from './IncidentRepository.js';

/**
 * In-memory {@link IncidentRepository} implementation, seeded from a fixed
 * list of incidents at construction time. Suitable for local development,
 * demos, and tests; state is lost on process restart. Every read and write
 * deep-clones its payload so callers can never mutate internal state by
 * holding a reference to a returned object.
 */
export class InMemoryIncidentRepository implements IncidentRepository {
  private readonly incidentsById = new Map<string, Incident>();

  constructor(seedIncidents: Incident[] = []) {
    for (const incident of seedIncidents) {
      this.incidentsById.set(incident.id, structuredClone(incident));
    }
  }

  async findAll(): Promise<Incident[]> {
    return Array.from(this.incidentsById.values()).map((incident) => structuredClone(incident));
  }

  async findById(id: string): Promise<Incident | null> {
    const incident = this.incidentsById.get(id);
    return incident ? structuredClone(incident) : null;
  }

  async create(input: CreateIncidentInput): Promise<Incident> {
    const now = new Date().toISOString();
    const incident: Incident = {
      id: createId('incident'),
      title: input.title,
      description: input.description,
      scenarioType: input.scenarioType ?? 'custom',
      status: 'draft',
      severity: input.severity,
      affectedService: input.affectedService,
      startedAt: input.startedAt ?? null,
      detectedAt: input.detectedAt,
      resolvedAt: null,
      resolutionNotes: null,
      createdAt: now,
      updatedAt: now,
      evidence: [],
      analysisRuns: [],
      skepticReviews: [],
      postmortem: null,
    };

    this.incidentsById.set(incident.id, incident);
    return structuredClone(incident);
  }

  async update(id: string, patch: UpdateIncidentInput): Promise<Incident | null> {
    const existing = this.incidentsById.get(id);
    if (!existing) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.incidentsById.set(id, updated);
    return structuredClone(updated);
  }

  async delete(id: string): Promise<boolean> {
    return this.incidentsById.delete(id);
  }

  async addEvidence(incidentId: string, evidence: EvidenceItem[]): Promise<Incident | null> {
    const existing = this.incidentsById.get(incidentId);
    if (!existing) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      evidence: [...existing.evidence, ...evidence],
      updatedAt: new Date().toISOString(),
    };

    this.incidentsById.set(incidentId, updated);
    return structuredClone(updated);
  }

  async addAnalysisRun(incidentId: string, run: AnalysisRun): Promise<Incident | null> {
    const existing = this.incidentsById.get(incidentId);
    if (!existing) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      analysisRuns: [...existing.analysisRuns, run],
      updatedAt: new Date().toISOString(),
    };

    this.incidentsById.set(incidentId, updated);
    return structuredClone(updated);
  }

  async addSkepticReview(incidentId: string, review: SkepticReview): Promise<Incident | null> {
    const existing = this.incidentsById.get(incidentId);
    if (!existing) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      skepticReviews: [...existing.skepticReviews, review],
      updatedAt: new Date().toISOString(),
    };

    this.incidentsById.set(incidentId, updated);
    return structuredClone(updated);
  }

  async updateSkepticReviewNotes(
    incidentId: string,
    reviewId: string,
    humanNotes: string,
  ): Promise<Incident | null> {
    const existing = this.incidentsById.get(incidentId);
    if (!existing) {
      return null;
    }

    let found = false;
    const skepticReviews: SkepticReview[] = existing.skepticReviews.map((review) => {
      if (review.id !== reviewId) {
        return review;
      }
      found = true;
      return { ...review, humanNotes };
    });

    if (!found) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      skepticReviews,
      updatedAt: new Date().toISOString(),
    };

    this.incidentsById.set(incidentId, updated);
    return structuredClone(updated);
  }

  async setPostmortem(incidentId: string, postmortem: Postmortem): Promise<Incident | null> {
    const existing = this.incidentsById.get(incidentId);
    if (!existing) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      postmortem,
      updatedAt: new Date().toISOString(),
    };

    this.incidentsById.set(incidentId, updated);
    return structuredClone(updated);
  }

  async updateStatementReviewStatus(
    incidentId: string,
    statementId: string,
    reviewStatus: ReviewStatus,
  ): Promise<Incident | null> {
    const existing = this.incidentsById.get(incidentId);
    if (!existing) {
      return null;
    }

    let found = false;
    const analysisRuns: AnalysisRun[] = existing.analysisRuns.map((run) => {
      const updateStatement = (item: AnalysisRun['facts'][number]) => {
        if (item.id !== statementId) {
          return item;
        }
        found = true;
        return { ...item, reviewStatus };
      };

      return {
        ...run,
        facts: run.facts.map(updateStatement),
        assumptions: run.assumptions.map(updateStatement),
      };
    });

    if (!found) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      analysisRuns,
      updatedAt: new Date().toISOString(),
    };

    this.incidentsById.set(incidentId, updated);
    return structuredClone(updated);
  }

  async updateHypothesisStatus(
    incidentId: string,
    hypothesisId: string,
    newStatus: HypothesisStatus,
    humanReviewNote: string | null,
  ): Promise<Incident | null> {
    const existing = this.incidentsById.get(incidentId);
    if (!existing) {
      return null;
    }

    let found = false;
    const reviewedAt = new Date().toISOString();
    const analysisRuns: AnalysisRun[] = existing.analysisRuns.map((run) => ({
      ...run,
      hypotheses: run.hypotheses.map((hypothesis) => {
        if (hypothesis.id !== hypothesisId) {
          return hypothesis;
        }
        found = true;
        return {
          ...hypothesis,
          previousStatus: hypothesis.status,
          status: newStatus,
          reviewedAt,
          humanReviewNote,
        };
      }),
    }));

    if (!found) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      analysisRuns,
      updatedAt: new Date().toISOString(),
    };

    this.incidentsById.set(incidentId, updated);
    return structuredClone(updated);
  }
}
