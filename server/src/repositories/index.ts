import { sampleIncidents } from '../data/incidents/index.js';
import { InMemoryIncidentRepository } from './InMemoryIncidentRepository.js';
import type { IncidentRepository } from './IncidentRepository.js';

export type { IncidentRepository };
export { InMemoryIncidentRepository };

/**
 * Process-wide incident repository, seeded with the bundled sample
 * incidents. Controllers introduced in later stages should import this
 * instance rather than constructing their own.
 */
export const incidentRepository: IncidentRepository = new InMemoryIncidentRepository(
  sampleIncidents,
);
