import type { Incident } from '../../../../shared/types/incident.js';

const INCIDENT_ID = 'sample-payment-gateway-timeout';
const DETECTED_AT = '2026-07-18T16:05:00Z';

/**
 * Sample incident: elevated payment failures reported as third-party
 * gateway timeouts. Deliberately supports both an external-provider
 * explanation (the vendor's own status alert, a genuine network-instability
 * signal) and an internal-system explanation (a same-day deploy that
 * tightened the client-side timeout from 10s to 3s, plus a no-backoff retry
 * loop amplifying load on both sides) with neither ruled out by any single
 * item. The vendor's own "elevated latency" alert is included specifically
 * as an automation-bias / anchoring-bias trap -- an unconfirmed,
 * third-party-reported status that a careless analysis might treat as
 * settled fact. A partial-success data point directly contradicts an
 * overconfident "the gateway is down" conclusion.
 */
export const paymentGatewayTimeoutIncident: Incident = {
  id: INCIDENT_ID,
  title: 'Elevated payment failures reported as gateway timeouts',
  description:
    'Since roughly 15:40 UTC, payment-processing-service has seen a sharp rise in failed ' +
    'payments, with logs showing timeouts calling the GlobalPay gateway. GlobalPay has posted ' +
    'an informal notice of elevated latency on their side, but has not confirmed an incident. ' +
    'The majority of payments are still failing, though a meaningful minority still succeed.',
  scenarioType: 'payment-gateway-timeout',
  status: 'draft',
  severity: 'critical',
  affectedService: 'payment-processing-service',
  startedAt: '2026-07-18T15:40:00Z',
  detectedAt: DETECTED_AT,
  resolvedAt: null,
  resolutionNotes: null,
  createdAt: DETECTED_AT,
  updatedAt: DETECTED_AT,
  analysisRuns: [],
  skepticReviews: [],
  postmortem: null,
  evidence: [
    {
      id: `${INCIDENT_ID}-ev-01`,
      incidentId: INCIDENT_ID,
      sourceType: 'incident-description',
      sourceName: 'Incident report',
      originalContent:
        'Since roughly 15:40 UTC, payment-processing-service has seen a sharp rise in failed ' +
        'payments, with logs showing timeouts calling the GlobalPay gateway. GlobalPay has ' +
        'posted an informal notice of elevated latency on their side, but has not confirmed an ' +
        'incident. The majority of payments are still failing, though a meaningful minority ' +
        'still succeed.',
      normalizedContent:
        'Since roughly 15:40 UTC, payment-processing-service has seen a sharp rise in failed ' +
        'payments, with logs showing timeouts calling the GlobalPay gateway. GlobalPay has ' +
        'posted an informal notice of elevated latency on their side, but has not confirmed an ' +
        'incident. The majority of payments are still failing, though a meaningful minority ' +
        'still succeed.',
      timestamp: DETECTED_AT,
      lineNumber: null,
      metadata: {},
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-02`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'GlobalPay status page (third party)',
      originalContent:
        '"We are investigating reports of elevated latency for some payment processing ' +
        'requests." Posted 15:48 UTC. No incident confirmed; no ETA given; not updated since.',
      normalizedContent:
        '"We are investigating reports of elevated latency for some payment processing ' +
        'requests." Posted 15:48 UTC. No incident confirmed; no ETA given; not updated since.',
      timestamp: '2026-07-18T15:48:00Z',
      lineNumber: null,
      metadata: { source: 'GlobalPay', confirmed: false },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-03`,
      incidentId: INCIDENT_ID,
      sourceType: 'api-error',
      sourceName: 'payment-processing-service-error.log',
      originalContent:
        "POST https://api.globalpay.example/v3/charge -- 512 failures between 15:42 and 16:04 " +
        "UTC. Error: 'request timed out after 3000ms'.",
      normalizedContent:
        "POST https://api.globalpay.example/v3/charge -- 512 failures between 15:42 and 16:04 " +
        "UTC. Error: 'request timed out after 3000ms'.",
      timestamp: '2026-07-18T15:42:00Z',
      lineNumber: 640,
      metadata: { httpStatus: 504, count: 512, timeoutMs: 3000 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-04`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'payment-processing-service.log',
      originalContent:
        'WARN: charge request retried 3 times with no backoff delay between attempts (0ms, ' +
        '0ms) for 89% of failed requests observed between 15:42 and 16:04 UTC, tripling ' +
        'outbound call volume to GlobalPay for each original failure.',
      normalizedContent:
        'WARN: charge request retried 3 times with no backoff delay between attempts (0ms, ' +
        '0ms) for 89% of failed requests observed between 15:42 and 16:04 UTC, tripling ' +
        'outbound call volume to GlobalPay for each original failure.',
      timestamp: '2026-07-18T15:50:00Z',
      lineNumber: 812,
      metadata: { level: 'WARN', retries: 3, backoffMs: 0, affectedPct: 89 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-05`,
      incidentId: INCIDENT_ID,
      sourceType: 'deployment-note',
      sourceName: 'deploy-log-payment-processing-service',
      originalContent:
        'payment-processing-service deployed v8.3.0 at 15:20 UTC: reduced the GlobalPay HTTP ' +
        'client timeout from 10000ms to 3000ms as part of an unrelated "fail fast on slow ' +
        'dependencies" reliability initiative planned two sprints ago.',
      normalizedContent:
        'payment-processing-service deployed v8.3.0 at 15:20 UTC: reduced the GlobalPay HTTP ' +
        'client timeout from 10000ms to 3000ms as part of an unrelated "fail fast on slow ' +
        'dependencies" reliability initiative planned two sprints ago.',
      timestamp: '2026-07-18T15:20:00Z',
      lineNumber: null,
      metadata: { version: 'v8.3.0', service: 'payment-processing-service', timeoutMsBefore: 10000, timeoutMsAfter: 3000 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-06`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Network operations dashboard',
      originalContent:
        'Elevated packet loss (2.1%, baseline < 0.1%) and TCP retransmit rate observed on the ' +
        'egress path to GlobalPay\'s us-east region between 15:41 and 16:00 UTC.',
      normalizedContent:
        'Elevated packet loss (2.1%, baseline < 0.1%) and TCP retransmit rate observed on the ' +
        'egress path to GlobalPay\'s us-east region between 15:41 and 16:00 UTC.',
      timestamp: '2026-07-18T15:41:00Z',
      lineNumber: null,
      metadata: { metric: 'packet_loss_pct', value: 2.1, baseline: 0.1 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-07`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'payment-processing-service.log',
      originalContent:
        'INFO: 62% of charge requests completed successfully between 15:42 and 16:04 UTC ' +
        '(baseline success rate 99.8%) -- a majority-but-not-total degradation, not a hard outage.',
      normalizedContent:
        'INFO: 62% of charge requests completed successfully between 15:42 and 16:04 UTC ' +
        '(baseline success rate 99.8%) -- a majority-but-not-total degradation, not a hard outage.',
      timestamp: '2026-07-18T16:04:00Z',
      lineNumber: 990,
      metadata: { level: 'INFO', successRatePct: 62, baselineSuccessRatePct: 99.8 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-08`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        'fraud-detection-service CPU usage elevated to 71% (baseline 45%) starting 15:44 UTC. ' +
        'fraud-detection-service is not in the charge request path for standard payments.',
      normalizedContent:
        'fraud-detection-service CPU usage elevated to 71% (baseline 45%) starting 15:44 UTC. ' +
        'fraud-detection-service is not in the charge request path for standard payments.',
      timestamp: '2026-07-18T15:44:00Z',
      lineNumber: null,
      metadata: { metric: 'cpu_pct', value: 71, baseline: 45, service: 'fraud-detection-service' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-09`,
      incidentId: INCIDENT_ID,
      sourceType: 'user-report',
      sourceName: 'Support ticket queue',
      originalContent:
        "14 tickets between 15:45 and 16:05 UTC: 'payment page hung for a while then showed an " +
        "error', 'card was declined but my bank shows nothing pending', 'tried again and it " +
        "worked the second time'.",
      normalizedContent:
        "14 tickets between 15:45 and 16:05 UTC: 'payment page hung for a while then showed an " +
        "error', 'card was declined but my bank shows nothing pending', 'tried again and it " +
        "worked the second time'.",
      timestamp: '2026-07-18T15:45:00Z',
      lineNumber: null,
      metadata: { ticketCount: 14 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-10`,
      incidentId: INCIDENT_ID,
      sourceType: 'other',
      sourceName: 'Vendor escalation tracker',
      originalContent:
        'A support ticket was opened with GlobalPay at 15:55 UTC requesting confirmation of an ' +
        'incident on their end. As of this report, GlobalPay has not responded with any ' +
        'confirmation, root cause, or ETA.',
      normalizedContent:
        'A support ticket was opened with GlobalPay at 15:55 UTC requesting confirmation of an ' +
        'incident on their end. As of this report, GlobalPay has not responded with any ' +
        'confirmation, root cause, or ETA.',
      timestamp: null,
      lineNumber: null,
      metadata: { vendor: 'GlobalPay', vendorConfirmed: false },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-11`,
      incidentId: INCIDENT_ID,
      sourceType: 'support-message',
      sourceName: 'On-call engineer notes',
      originalContent:
        'The exact moment the failure rate began climbing is unclear -- the first alert only ' +
        'fired once the error-rate threshold was crossed at 15:44 UTC, but on-call believes ' +
        'based on scattered early tickets that it may have started a few minutes earlier.',
      normalizedContent:
        'The exact moment the failure rate began climbing is unclear -- the first alert only ' +
        'fired once the error-rate threshold was crossed at 15:44 UTC, but on-call believes ' +
        'based on scattered early tickets that it may have started a few minutes earlier.',
      timestamp: null,
      lineNumber: null,
      metadata: {},
      createdAt: DETECTED_AT,
    },
  ],
};
