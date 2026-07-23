import type { ScenarioEvaluationFixture } from './types.js';

const ID = 'sample-db-connection-leak';

/**
 * Evaluation fixture for {@link databaseConnectionLeakIncident}. See
 * `types.ts` for what this is (and is not) used for.
 */
export const databaseConnectionLeakEvaluation: ScenarioEvaluationFixture = {
  incidentId: ID,
  expectedFacts: [
    {
      statement:
        'A deploy (v5.2.0) reworking DB session scoping went out at 09:35 UTC, shortly before ' +
        'the failures began.',
      evidenceIds: [`${ID}-ev-02`],
    },
    {
      statement:
        'orders-service began returning 500 errors citing connection-pool exhaustion starting ' +
        'around 09:50 UTC.',
      evidenceIds: [`${ID}-ev-05`, `${ID}-ev-06`],
    },
    {
      statement:
        'Connection-pool utilization rose gradually from 42% to 100% over about 25 minutes, ' +
        'rather than spiking suddenly.',
      evidenceIds: [`${ID}-ev-03`],
    },
    {
      statement:
        'orders-service request volume increased about 35% around the same time, driven by a ' +
        'promotional email campaign.',
      evidenceIds: [`${ID}-ev-04`],
    },
    {
      statement: 'The deploy did not change the configured connection-pool maximum size.',
      evidenceIds: [`${ID}-ev-02`],
    },
    {
      statement:
        'The frequency of "session closed" log lines dropped sharply after the deploy while ' +
        '"session opened" frequency stayed roughly constant.',
      evidenceIds: [`${ID}-ev-07`],
    },
  ],
  mustNotBePresentedAsFacts: [
    'The deploy caused a connection leak in the new ORM session code.',
    'The traffic increase alone exhausted the pool.',
    'The scheduled autovacuum job caused or contributed to the incident.',
  ],
  plausibleHypotheses: [
    {
      id: 'deploy-introduced-leak',
      summary:
        'The new request-scoped session pattern shipped in v5.2.0 fails to release a DB ' +
        'session on some exception path, leaking connections over time.',
      supportingEvidenceIds: [`${ID}-ev-02`, `${ID}-ev-07`],
      contradictingEvidenceIds: [`${ID}-ev-04`, `${ID}-ev-10`],
    },
    {
      id: 'traffic-growth-saturated-pool',
      summary:
        'The 35% traffic increase from the marketing campaign alone was enough to saturate an ' +
        'already-near-capacity connection pool, with no code defect involved.',
      supportingEvidenceIds: [`${ID}-ev-04`, `${ID}-ev-09`],
      contradictingEvidenceIds: [`${ID}-ev-07`],
    },
    {
      id: 'combined-effect',
      summary:
        'Neither the deploy nor the traffic increase alone would have exhausted the pool, but ' +
        'the two together did.',
      supportingEvidenceIds: [`${ID}-ev-02`, `${ID}-ev-04`, `${ID}-ev-03`],
      contradictingEvidenceIds: [],
    },
    {
      id: 'pool-size-reduced-decoy',
      summary: 'The deploy reduced the configured connection-pool maximum size.',
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [`${ID}-ev-02`],
    },
  ],
  challengingEvidenceIdsForLeadingExplanation: [`${ID}-ev-04`, `${ID}-ev-10`],
  expectedReasoningRisks: ['post-hoc-fallacy', 'confirmation-bias', 'anchoring-bias', 'base-rate-neglect'],
  distractingEvidenceIds: [`${ID}-ev-08`],
  missingInformationEvidenceIds: [`${ID}-ev-11`],
  approximateOrInferredEvidenceIds: [`${ID}-ev-10`, `${ID}-ev-11`],
  openQuestions: [
    'Does the new ORM session-scoping code have a path where a session is not released on an ' +
      'exception, and if so, which one?',
    'Would the pool have been exhausted by the traffic increase alone, without the deploy?',
    'Were the prior sporadic pool-utilization alerts ever root-caused, or did they simply ' +
      'self-resolve unexplained?',
  ],
};
