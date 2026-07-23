import type { ScenarioEvaluationFixture } from './types.js';

const ID = 'sample-async-queue-backlog';

/**
 * Evaluation fixture for {@link asyncQueueBacklogIncident}. See `types.ts`
 * for what this is (and is not) used for.
 */
export const asyncQueueBacklogEvaluation: ScenarioEvaluationFixture = {
  incidentId: ID,
  expectedFacts: [
    {
      statement:
        'Queue depth grew from a baseline of ~200 messages to 15,400 messages between 08:00 and ' +
        '13:15 UTC.',
      evidenceIds: [`${ID}-ev-02`],
    },
    {
      statement:
        'A deploy at 07:50 UTC reduced consumer pod count from 12 to 6 while increasing per-pod ' +
        'concurrency from 4 to 8, for a stated unchanged theoretical total concurrency of 48.',
      evidenceIds: [`${ID}-ev-03`],
    },
    {
      statement: '247 messages were moved to the dead-letter queue after exceeding the 5-attempt retry limit.',
      evidenceIds: [`${ID}-ev-04`],
    },
    {
      statement:
        'At least 63 message ids failed repeatedly with the identical NullPointerException stack ' +
        'trace in ShippingAddressNormalizer.',
      evidenceIds: [`${ID}-ev-05`],
    },
    {
      statement: 'shipping-rate-api p95 latency rose from a 180ms baseline to 2,400ms during the incident window.',
      evidenceIds: [`${ID}-ev-06`],
    },
    {
      statement:
        'Producer-side (order-creation) throughput stayed within its normal 200-250 ' +
        'messages/hour baseline throughout the incident.',
      evidenceIds: [`${ID}-ev-07`],
    },
  ],
  mustNotBePresentedAsFacts: [
    'Reducing the consumer pod count caused the backlog.',
    'The poison messages alone caused the entire backlog.',
    'The nightly analytics ETL CPU spike caused or contributed to the backlog.',
  ],
  plausibleHypotheses: [
    {
      id: 'reduced-consumer-capacity',
      summary:
        'The pod-count reduction cut effective processing capacity despite the concurrency ' +
        'increase intended to compensate for it.',
      supportingEvidenceIds: [`${ID}-ev-03`],
      contradictingEvidenceIds: [`${ID}-ev-07`],
    },
    {
      id: 'poison-messages-starving-throughput',
      summary:
        'A batch of malformed messages is repeatedly failing and consuming retry cycles, ' +
        'starving healthy messages of consumer capacity.',
      supportingEvidenceIds: [`${ID}-ev-04`, `${ID}-ev-05`],
      contradictingEvidenceIds: [],
    },
    {
      id: 'downstream-dependency-slowness',
      summary:
        'Each message\'s processing time increased because it blocks on the now-slower ' +
        'shipping-rate-api call, so consumers fall behind even at unchanged capacity.',
      supportingEvidenceIds: [`${ID}-ev-06`],
      contradictingEvidenceIds: [],
    },
    {
      id: 'etl-cpu-spike-decoy',
      summary: 'The nightly analytics ETL CPU spike caused the backlog.',
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [`${ID}-ev-09`],
    },
  ],
  challengingEvidenceIdsForLeadingExplanation: [`${ID}-ev-07`, `${ID}-ev-09`, `${ID}-ev-11`],
  expectedReasoningRisks: ['confirmation-bias', 'anchoring-bias', 'post-hoc-fallacy', 'hindsight-bias'],
  distractingEvidenceIds: [`${ID}-ev-09`],
  missingInformationEvidenceIds: [`${ID}-ev-10`],
  approximateOrInferredEvidenceIds: [`${ID}-ev-10`, `${ID}-ev-11`],
  openQuestions: [
    'Did the concurrency increase (4 -> 8 per pod) actually deliver its intended throughput, or ' +
      'is per-pod resource contention limiting real-world capacity below the theoretical 48?',
    'How much of the 15,400-message backlog is attributable to the ~63 poison messages versus ' +
      'genuinely slow processing of otherwise-healthy messages?',
    'Would the backlog have occurred at all if shipping-rate-api\'s latency had not regressed?',
  ],
};
