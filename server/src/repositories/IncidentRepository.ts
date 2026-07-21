import type { AnalysisRun } from '../../../shared/types/analysisRun.js';
import type { EvidenceItem } from '../../../shared/types/evidence.js';
import type {
  CreateIncidentInput,
  Incident,
  UpdateIncidentInput,
} from '../../../shared/types/incident.js';

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
}
