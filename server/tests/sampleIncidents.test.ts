import { describe, expect, it } from 'vitest';
import { sampleIncidents } from '../src/data/incidents/index.js';

describe('sample incident datasets', () => {
  it('ships exactly three sample incidents', () => {
    expect(sampleIncidents).toHaveLength(3);
  });

  it('covers the three required scenario types', () => {
    const scenarioTypes = sampleIncidents.map((incident) => incident.scenarioType).sort();
    expect(scenarioTypes).toEqual(
      ['course-registration-slowdown', 'ecommerce-checkout', 'mobile-login-failure'].sort(),
    );
  });

  it('has globally unique incident ids', () => {
    const ids = sampleIncidents.map((incident) => incident.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every incident a rich, ambiguous evidence set', () => {
    for (const incident of sampleIncidents) {
      expect(incident.evidence.length).toBeGreaterThanOrEqual(8);

      const sourceTypes = new Set(incident.evidence.map((item) => item.sourceType));
      expect(sourceTypes.size).toBeGreaterThanOrEqual(4);
    }
  });

  it('has no analysis runs yet (analysis is generated in a later stage)', () => {
    for (const incident of sampleIncidents) {
      expect(incident.analysisRuns).toEqual([]);
      expect(incident.status).toBe('draft');
    }
  });

  for (const incident of sampleIncidents) {
    describe(`incident: ${incident.id}`, () => {
      it('has evidence ids unique within the incident', () => {
        const ids = incident.evidence.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('links every evidence item back to its parent incident', () => {
        for (const evidence of incident.evidence) {
          expect(evidence.incidentId).toBe(incident.id);
        }
      });

      it('has parseable timestamps for every dated evidence item', () => {
        for (const evidence of incident.evidence) {
          if (evidence.timestamp !== null) {
            expect(Number.isNaN(Date.parse(evidence.timestamp))).toBe(false);
          }
        }
      });

      it('detected the incident at or after it started', () => {
        if (incident.startedAt) {
          expect(Date.parse(incident.detectedAt)).toBeGreaterThanOrEqual(
            Date.parse(incident.startedAt),
          );
        }
      });
    });
  }
});
