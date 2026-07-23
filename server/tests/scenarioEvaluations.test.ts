import { describe, expect, it } from 'vitest';
import {
  databaseConnectionLeakIncident,
  paymentGatewayTimeoutIncident,
  asyncQueueBacklogIncident,
} from '../src/data/incidents/index.js';
import { scenarioEvaluations } from './fixtures/scenarioEvaluations/index.js';
import type { ScenarioEvaluationFixture } from './fixtures/scenarioEvaluations/types.js';
import type { Incident } from '../../shared/types/incident.js';

const incidentsById = new Map<string, Incident>(
  [databaseConnectionLeakIncident, paymentGatewayTimeoutIncident, asyncQueueBacklogIncident].map((incident) => [
    incident.id,
    incident,
  ]),
);

function incidentFor(fixture: ScenarioEvaluationFixture): Incident {
  const incident = incidentsById.get(fixture.incidentId);
  if (!incident) {
    throw new Error(`No incident found for evaluation fixture "${fixture.incidentId}".`);
  }
  return incident;
}

describe('scenario evaluation fixtures', () => {
  it('ships an evaluation fixture for each of the three new scenarios', () => {
    expect(scenarioEvaluations).toHaveLength(3);
    expect(new Set(scenarioEvaluations.map((fixture) => fixture.incidentId))).toEqual(
      new Set([databaseConnectionLeakIncident.id, paymentGatewayTimeoutIncident.id, asyncQueueBacklogIncident.id]),
    );
  });

  for (const fixture of scenarioEvaluations) {
    describe(`fixture for ${fixture.incidentId}`, () => {
      const incident = incidentFor(fixture);
      const realEvidenceIds = new Set(incident.evidence.map((item) => item.id));

      function expectValidEvidenceIds(ids: readonly string[], label: string): void {
        for (const id of ids) {
          expect(realEvidenceIds.has(id), `${label} references unknown evidence id "${id}"`).toBe(true);
        }
      }

      it('every expected fact cites at least one real evidence id', () => {
        expect(fixture.expectedFacts.length).toBeGreaterThan(0);
        for (const fact of fixture.expectedFacts) {
          expect(fact.evidenceIds.length, `fact "${fact.statement}" cites no evidence`).toBeGreaterThan(0);
          expectValidEvidenceIds(fact.evidenceIds, `expectedFacts["${fact.statement}"]`);
        }
      });

      it('no assumption/must-not-be-a-fact claim is duplicated verbatim as an expected fact', () => {
        const factStatements = new Set(fixture.expectedFacts.map((fact) => fact.statement));
        for (const assumption of fixture.mustNotBePresentedAsFacts) {
          expect(factStatements.has(assumption)).toBe(false);
        }
        expect(fixture.mustNotBePresentedAsFacts.length).toBeGreaterThan(0);
      });

      it('contains more than one plausible, evidence-referenced hypothesis', () => {
        expect(fixture.plausibleHypotheses.length).toBeGreaterThanOrEqual(3);
        for (const hypothesis of fixture.plausibleHypotheses) {
          expectValidEvidenceIds(hypothesis.supportingEvidenceIds, `hypothesis "${hypothesis.id}" supporting`);
          expectValidEvidenceIds(hypothesis.contradictingEvidenceIds, `hypothesis "${hypothesis.id}" contradicting`);
        }
      });

      it('contains at least one supporting and at least one contradicting evidence reference across its hypotheses', () => {
        const totalSupporting = fixture.plausibleHypotheses.reduce((n, h) => n + h.supportingEvidenceIds.length, 0);
        const totalContradicting = fixture.plausibleHypotheses.reduce(
          (n, h) => n + h.contradictingEvidenceIds.length,
          0,
        );
        expect(totalSupporting).toBeGreaterThan(0);
        expect(totalContradicting).toBeGreaterThan(0);
      });

      it('includes at least one hypothesis a careful analysis should reject (evidence-contradicted, unsupported)', () => {
        const hasRejectableDecoy = fixture.plausibleHypotheses.some(
          (h) => h.supportingEvidenceIds.length === 0 && h.contradictingEvidenceIds.length > 0,
        );
        expect(hasRejectableDecoy).toBe(true);
      });

      it('identifies evidence that should challenge the leading explanation', () => {
        expect(fixture.challengingEvidenceIdsForLeadingExplanation.length).toBeGreaterThan(0);
        expectValidEvidenceIds(fixture.challengingEvidenceIdsForLeadingExplanation, 'challengingEvidenceIdsForLeadingExplanation');
      });

      it('flags at least one deliberately distracting/irrelevant evidence item', () => {
        expect(fixture.distractingEvidenceIds.length).toBeGreaterThan(0);
        expectValidEvidenceIds(fixture.distractingEvidenceIds, 'distractingEvidenceIds');
      });

      it('flags at least one evidence item describing missing information', () => {
        expect(fixture.missingInformationEvidenceIds.length).toBeGreaterThan(0);
        expectValidEvidenceIds(fixture.missingInformationEvidenceIds, 'missingInformationEvidenceIds');
      });

      it('flags approximate/inferred evidence, and every flagged item truly has a null timestamp in the incident data', () => {
        expect(fixture.approximateOrInferredEvidenceIds.length).toBeGreaterThan(0);
        expectValidEvidenceIds(fixture.approximateOrInferredEvidenceIds, 'approximateOrInferredEvidenceIds');

        const evidenceById = new Map(incident.evidence.map((item) => [item.id, item]));
        for (const id of fixture.approximateOrInferredEvidenceIds) {
          expect(evidenceById.get(id)?.timestamp, `evidence "${id}" should have a null (approximate) timestamp`).toBeNull();
        }
      });

      it('the incident has at least one item with an exact (non-null) timestamp', () => {
        const exactCount = incident.evidence.filter((item) => item.timestamp !== null).length;
        expect(exactCount).toBeGreaterThan(0);
      });

      it('names at least three expected reasoning risks, matching the scenario design', () => {
        expect(fixture.expectedReasoningRisks.length).toBeGreaterThanOrEqual(3);
      });

      it('flags genuine open questions', () => {
        expect(fixture.openQuestions.length).toBeGreaterThan(0);
      });
    });
  }
});
