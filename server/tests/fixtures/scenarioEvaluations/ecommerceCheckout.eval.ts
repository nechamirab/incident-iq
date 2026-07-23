import type { ScenarioEvaluationFixture } from './types.js';

const ID = 'sample-ecommerce-checkout';

/**
 * Evaluation fixture for {@link ecommerceCheckoutIncident} (one of the
 * three original bundled scenarios). See `types.ts` for what this is (and
 * is not) used for.
 */
export const ecommerceCheckoutEvaluation: ScenarioEvaluationFixture = {
  incidentId: ID,
  expectedFacts: [
    {
      statement:
        'Checkout failures began around 14:30 UTC, following support reports of a "Payment could ' +
        'not be processed" error.',
      evidenceIds: [`${ID}-ev-01`],
    },
    {
      statement:
        'checkout-api deployed v2.4.1 at 14:28 UTC, which reduced the DB connection pool size from ' +
        '50 to 20 per pod.',
      evidenceIds: [`${ID}-ev-02`],
    },
    {
      statement: 'checkout-api logged 47 DB connection-timeout failures between 14:33 and 14:55 UTC.',
      evidenceIds: [`${ID}-ev-03`],
    },
    {
      statement:
        'postgres-primary logged 12 "remaining connection slots are reserved" FATAL errors between ' +
        '14:34 and 14:50 UTC.',
      evidenceIds: [`${ID}-ev-04`],
    },
    {
      statement:
        'The upstream payment provider (Stripe) was reporting elevated latency (avg 2100ms) shortly ' +
        'before the failures began.',
      evidenceIds: [`${ID}-ev-07`],
    },
    {
      statement: 'checkout-api pod count auto-scaled from 10 to 14 due to sustained CPU pressure.',
      evidenceIds: [`${ID}-ev-12`],
    },
  ],
  mustNotBePresentedAsFacts: [
    "The v2.4.1 deploy's reduced connection pool size caused the checkout failures.",
    "Stripe's elevated latency is the root cause.",
    'The Redis session-cache warning and the new-tax-calculation feature flag are related to this incident.',
  ],
  plausibleHypotheses: [
    {
      id: 'pool-size-reduction',
      summary:
        "The v2.4.1 deploy's reduction of the DB connection pool from 50 to 20 per pod left too " +
        'little headroom, causing connection timeouts under normal load.',
      supportingEvidenceIds: [`${ID}-ev-02`, `${ID}-ev-03`, `${ID}-ev-04`],
      contradictingEvidenceIds: [`${ID}-ev-07`],
    },
    {
      id: 'stripe-latency',
      summary:
        'Elevated latency from the upstream Stripe payment provider caused checkout requests to ' +
        'hold DB connections longer, exhausting the reduced pool indirectly.',
      supportingEvidenceIds: [`${ID}-ev-07`, `${ID}-ev-05`],
      contradictingEvidenceIds: [`${ID}-ev-02`],
    },
    {
      id: 'traffic-growth',
      summary:
        'Organic traffic growth (reflected in the pod autoscale from 10 to 14) pushed connection ' +
        "demand past the newly-reduced pool's capacity.",
      supportingEvidenceIds: [`${ID}-ev-12`],
      contradictingEvidenceIds: [`${ID}-ev-02`],
    },
    {
      id: 'cache-or-flag-decoy',
      summary:
        'The Redis session-cache eviction warning or the new-tax-calculation feature flag caused ' +
        'the checkout failures.',
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [`${ID}-ev-10`, `${ID}-ev-11`],
    },
  ],
  challengingEvidenceIdsForLeadingExplanation: [`${ID}-ev-07`, `${ID}-ev-12`, `${ID}-ev-13`],
  expectedReasoningRisks: ['post-hoc-fallacy', 'confirmation-bias', 'anchoring-bias', 'availability-bias'],
  distractingEvidenceIds: [`${ID}-ev-10`, `${ID}-ev-11`],
  missingInformationEvidenceIds: [`${ID}-ev-14`],
  approximateOrInferredEvidenceIds: [`${ID}-ev-13`, `${ID}-ev-14`],
  openQuestions: [
    'Would the reduced connection pool alone have caused exhaustion without the Stripe latency, or vice versa?',
    'Were the prior sporadic connection-timeout occurrences ever root-caused, or did they simply self-resolve unexplained?',
    'Is the checkout-api pod autoscale a cause of increased connection demand, or a downstream effect of the same underlying pressure?',
  ],
};
