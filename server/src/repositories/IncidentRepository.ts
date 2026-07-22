import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { EvidenceItem } from '../../../shared/types/evidence.js';
import type {
  CreateIncidentInput,
  Incident,
  UpdateIncidentInput,
} from '../../../shared/types/incident.js';
import type { Postmortem } from '../../../shared/types/postmortem.js';
import type { ReviewStatus } from '../../../shared/types/reasoning.js';
import type { SkepticReview } from '../../../shared/types/skepticReview.js';

/**
 * Persistence contract for incidents. Controllers and services depend only
 * on this interface, never on a concrete implementation, so the in-memory
 * store used today can be swapped for a real database later without
 * touching any calling code.
 */
export interface IncidentRepository {
  findAll(): Promise<Incident[]>;
  findById(id: string): Promise<Incident | null>;
  create(input: CreateIncidentInput): Promise<Incident>;
  update(id: string, patch: UpdateIncidentInput): Promise<Incident | null>;
  delete(id: string): Promise<boolean>;
  addEvidence(incidentId: string, evidence: EvidenceItem[]): Promise<Incident | null>;
  addAnalysisRun(incidentId: string, run: AnalysisRun): Promise<Incident | null>;
  addSkepticReview(incidentId: string, review: SkepticReview): Promise<Incident | null>;

  /**
   * Updates the human-recorded review notes on one skeptic review.
   *
   * @returns The updated incident, or `null` if the incident or the
   * skeptic review (within it) could not be found.
   */
  updateSkepticReviewNotes(
    incidentId: string,
    reviewId: string,
    humanNotes: string,
  ): Promise<Incident | null>;

  /**
   * Replaces the incident's postmortem wholesale -- used both to set a
   * freshly (re)generated AI draft and to persist a human's edits (the
   * caller merges the edit into the existing document first). Unlike
   * `addAnalysisRun`/`addSkepticReview`, this is not append-only: a
   * postmortem is a single evolving document per incident.
   *
   * @returns The updated incident, or `null` if the incident could not be found.
   */
  setPostmortem(incidentId: string, postmortem: Postmortem): Promise<Incident | null>;

  /**
   * Updates the review status of one fact or assumption (a `ReasoningItem`
   * -- `statementId` is its id), searching every analysis run on the
   * incident since a statement always belongs to exactly one run.
   *
   * @returns The updated incident, or `null` if the incident or the
   * statement (within it) could not be found.
   */
  updateStatementReviewStatus(
    incidentId: string,
    statementId: string,
    reviewStatus: ReviewStatus,
  ): Promise<Incident | null>;
}
