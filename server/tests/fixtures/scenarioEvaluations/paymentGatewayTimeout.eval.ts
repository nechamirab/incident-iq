import type { ScenarioEvaluationFixture } from './types.js';

const ID = 'sample-payment-gateway-timeout';

/**
 * Evaluation fixture for {@link paymentGatewayTimeoutIncident}. See
 * `types.ts` for what this is (and is not) used for.
 */
export const paymentGatewayTimeoutEvaluation: ScenarioEvaluationFixture = {
  incidentId: ID,
  expectedFacts: [
    {
      statement:
        'payment-processing-service began logging timeouts calling GlobalPay\'s charge endpoint ' +
        'starting around 15:42 UTC.',
      evidenceIds: [`${ID}-ev-03`],
    },
    {
      statement: 'A deploy at 15:20 UTC reduced the GlobalPay HTTP client timeout from 10000ms to 3000ms.',
      evidenceIds: [`${ID}-ev-05`],
    },
    {
      statement:
        '89% of failed requests were retried 3 times with no backoff delay, tripling outbound ' +
        'call volume to GlobalPay for each original failure.',
      evidenceIds: [`${ID}-ev-04`],
    },
    {
      statement:
        'Elevated packet loss and TCP retransmits were observed on the network path to ' +
        'GlobalPay\'s region during the incident window.',
      evidenceIds: [`${ID}-ev-06`],
    },
    {
      statement:
        '62% of charge requests still completed successfully during the incident window, versus ' +
        'a 99.8% baseline.',
      evidenceIds: [`${ID}-ev-07`],
    },
    {
      statement:
        'GlobalPay posted an informal notice mentioning investigation of elevated latency, ' +
        'without confirming an incident.',
      evidenceIds: [`${ID}-ev-02`],
    },
  ],
  mustNotBePresentedAsFacts: [
    'GlobalPay is experiencing an outage or confirmed degradation.',
    'The reduced client-side timeout caused the failures.',
    'The fraud-detection-service CPU spike is related to this incident.',
  ],
  plausibleHypotheses: [
    {
      id: 'external-provider-latency',
      summary:
        'GlobalPay is genuinely experiencing elevated latency or instability upstream, ' +
        'independent of anything on our side.',
      supportingEvidenceIds: [`${ID}-ev-02`, `${ID}-ev-03`, `${ID}-ev-06`],
      contradictingEvidenceIds: [`${ID}-ev-05`],
    },
    {
      id: 'internal-timeout-misconfiguration',
      summary:
        'Our own reduced client-side timeout (10000ms -> 3000ms) is now clipping requests that ' +
        'would have succeeded under the previous, more generous timeout.',
      supportingEvidenceIds: [`${ID}-ev-05`, `${ID}-ev-03`],
      contradictingEvidenceIds: [`${ID}-ev-06`],
    },
    {
      id: 'retry-amplification',
      summary:
        'Aggressive retries with no backoff are amplifying load on both our system and the ' +
        'gateway, worsening whatever the initial latency was.',
      supportingEvidenceIds: [`${ID}-ev-04`],
      contradictingEvidenceIds: [],
    },
    {
      id: 'fraud-detection-overload-decoy',
      summary: 'Elevated CPU on fraud-detection-service caused the payment failures.',
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [`${ID}-ev-08`],
    },
  ],
  challengingEvidenceIdsForLeadingExplanation: [`${ID}-ev-05`, `${ID}-ev-07`, `${ID}-ev-10`],
  expectedReasoningRisks: ['automation-bias', 'availability-bias', 'anchoring-bias', 'overconfidence-bias'],
  distractingEvidenceIds: [`${ID}-ev-08`],
  missingInformationEvidenceIds: [`${ID}-ev-10`],
  approximateOrInferredEvidenceIds: [`${ID}-ev-10`, `${ID}-ev-11`],
  openQuestions: [
    'Has GlobalPay confirmed an incident on their end, and if so what is the root cause?',
    'Would reverting the timeout to 10000ms restore the previous success rate, or is the ' +
      'underlying latency itself the dominant factor regardless of timeout?',
    'How much of the load GlobalPay is currently seeing is amplified by our own no-backoff ' +
      'retries versus genuine new request volume?',
  ],
};
