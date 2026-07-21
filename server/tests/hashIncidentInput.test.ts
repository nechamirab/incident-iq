import { describe, expect, it } from 'vitest';
import { hashIncidentInput } from '../src/utils/hashIncidentInput.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import type { Incident } from '../../shared/types/incident.js';

describe('hashIncidentInput', () => {
  it('produces the same hash for the same incident content', () => {
    const incident = sampleIncidents[0];
    expect(hashIncidentInput(incident)).toBe(hashIncidentInput(incident));
  });

  it('produces different hashes for incidents with different evidence', () => {
    const [first, second] = sampleIncidents;
    expect(hashIncidentInput(first)).not.toBe(hashIncidentInput(second));
  });

  it('is independent of evidence array order', () => {
    const incident = sampleIncidents[0];
    const reversed: Incident = { ...incident, evidence: [...incident.evidence].reverse() };
    expect(hashIncidentInput(incident)).toBe(hashIncidentInput(reversed));
  });

  it('changes when evidence content changes', () => {
    const incident = sampleIncidents[0];
    const mutated: Incident = {
      ...incident,
      evidence: incident.evidence.map((item, index) =>
        index === 0 ? { ...item, normalizedContent: 'changed content' } : item,
      ),
    };
    expect(hashIncidentInput(incident)).not.toBe(hashIncidentInput(mutated));
  });
});
