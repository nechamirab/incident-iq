import type { Incident } from '../../../../shared/types/incident.js';

const INCIDENT_ID = 'sample-ecommerce-checkout';
const DETECTED_AT = '2026-06-14T14:41:00Z';

/**
 * Sample incident: checkout failures that began shortly after a routine
 * deployment. Deliberately ambiguous — the evidence mixes a plausible
 * technical cause (a reduced DB connection pool shipped in the deploy)
 * with several red herrings (a third-party latency warning, an unrelated
 * cache warning from ten minutes earlier, an unrelated feature flag, and a
 * successful request after the deploy) so no single log line gives away
 * the answer.
 */
export const ecommerceCheckoutIncident: Incident = {
  id: INCIDENT_ID,
  title: 'Checkout failures after v2.4.1 deployment',
  description:
    'Customers have been unable to complete checkout since roughly 14:30 UTC. Multiple support ' +
    'tickets mention a "Payment could not be processed" error on the final checkout step. The ' +
    'checkout-api service was deployed shortly before reports started coming in.',
  scenarioType: 'ecommerce-checkout',
  status: 'draft',
  severity: 'critical',
  affectedService: 'checkout-api',
  startedAt: '2026-06-14T14:30:00Z',
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
        'Customers have been unable to complete checkout since roughly 14:30 UTC. Multiple ' +
        'support tickets mention a "Payment could not be processed" error on the final ' +
        'checkout step. The checkout-api service was deployed shortly before reports started ' +
        'coming in.',
      normalizedContent:
        'Customers have been unable to complete checkout since roughly 14:30 UTC. Multiple ' +
        'support tickets mention a "Payment could not be processed" error on the final ' +
        'checkout step. The checkout-api service was deployed shortly before reports started ' +
        'coming in.',
      timestamp: '2026-06-14T14:41:00Z',
      lineNumber: null,
      metadata: {},
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-02`,
      incidentId: INCIDENT_ID,
      sourceType: 'deployment-note',
      sourceName: 'deploy-log-checkout-api',
      originalContent:
        'Deploy v2.4.1 to checkout-api completed at 14:28 UTC. Included: updated payment retry ' +
        'logic, DB connection pool size reduced from 50 to 20 per pod (part of a cost-reduction ' +
        'pass), and minor dependency bumps.',
      normalizedContent:
        'Deploy v2.4.1 to checkout-api completed at 14:28 UTC. Included: updated payment retry ' +
        'logic, DB connection pool size reduced from 50 to 20 per pod (part of a cost-reduction ' +
        'pass), and minor dependency bumps.',
      timestamp: '2026-06-14T14:28:00Z',
      lineNumber: null,
      metadata: { version: 'v2.4.1', service: 'checkout-api' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-03`,
      incidentId: INCIDENT_ID,
      sourceType: 'api-error',
      sourceName: 'checkout-api-error.log',
      originalContent:
        "POST /api/checkout/submit -- 47 failures between 14:33 and 14:55 UTC. Error: 'DB " +
        "connection timeout after 5000ms'.",
      normalizedContent:
        "POST /api/checkout/submit -- 47 failures between 14:33 and 14:55 UTC. Error: 'DB " +
        "connection timeout after 5000ms'.",
      timestamp: '2026-06-14T14:33:00Z',
      lineNumber: 118,
      metadata: { httpStatus: 500, count: 47 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-04`,
      incidentId: INCIDENT_ID,
      sourceType: 'database-error',
      sourceName: 'postgres-primary.log',
      originalContent:
        "FATAL: remaining connection slots are reserved -- logged 12 times between 14:34 and " +
        "14:50 UTC.",
      normalizedContent:
        "FATAL: remaining connection slots are reserved -- logged 12 times between 14:34 and " +
        "14:50 UTC.",
      timestamp: '2026-06-14T14:34:00Z',
      lineNumber: 902,
      metadata: { database: 'postgres-primary', count: 12 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-05`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        'checkout-api p95 latency exceeded 4000ms (threshold 800ms). Triggered 14:36 UTC, ' +
        'resolved 15:10 UTC.',
      normalizedContent:
        'checkout-api p95 latency exceeded 4000ms (threshold 800ms). Triggered 14:36 UTC, ' +
        'resolved 15:10 UTC.',
      timestamp: '2026-06-14T14:36:00Z',
      lineNumber: null,
      metadata: { metric: 'p95_latency_ms', value: 4000, threshold: 800 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-06`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent: 'checkout-api error rate reached 18% (threshold 2%). Triggered 14:37 UTC.',
      normalizedContent:
        'checkout-api error rate reached 18% (threshold 2%). Triggered 14:37 UTC.',
      timestamp: '2026-06-14T14:37:00Z',
      lineNumber: null,
      metadata: { metric: 'error_rate_pct', value: 18, threshold: 2 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-07`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'payment-gateway-adapter.log',
      originalContent:
        'WARN: upstream payment provider (Stripe) responding with elevated latency, avg 2100ms.',
      normalizedContent:
        'WARN: upstream payment provider (Stripe) responding with elevated latency, avg 2100ms.',
      timestamp: '2026-06-14T14:31:00Z',
      lineNumber: 34,
      metadata: { level: 'WARN', upstream: 'stripe' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-08`,
      incidentId: INCIDENT_ID,
      sourceType: 'user-report',
      sourceName: 'Support ticket queue',
      originalContent:
        "5 tickets between 14:35 and 15:00 UTC: 'Card declined unexpectedly', 'Checkout page " +
        "spinner never stops', 'Got a 500 error page', 'Tried 3 times, same error', 'Is the " +
        "store down?'.",
      normalizedContent:
        "5 tickets between 14:35 and 15:00 UTC: 'Card declined unexpectedly', 'Checkout page " +
        "spinner never stops', 'Got a 500 error page', 'Tried 3 times, same error', 'Is the " +
        "store down?'.",
      timestamp: '2026-06-14T14:35:00Z',
      lineNumber: null,
      metadata: { ticketCount: 5 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-09`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'checkout-api.log',
      originalContent: 'INFO: checkout completed successfully for order #88213 (200 OK, 320ms).',
      normalizedContent:
        'INFO: checkout completed successfully for order #88213 (200 OK, 320ms).',
      timestamp: '2026-06-14T14:44:00Z',
      lineNumber: 205,
      metadata: { level: 'INFO', httpStatus: 200, orderId: '88213' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-10`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'cache-warmer.log',
      originalContent: 'WARN: Redis key eviction rate elevated for session cache.',
      normalizedContent: 'WARN: Redis key eviction rate elevated for session cache.',
      timestamp: '2026-06-14T14:20:00Z',
      lineNumber: 12,
      metadata: { level: 'WARN', component: 'session-cache' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-11`,
      incidentId: INCIDENT_ID,
      sourceType: 'deployment-note',
      sourceName: 'feature-flag-log',
      originalContent:
        "Feature flag 'new-tax-calculation' enabled for 5% of traffic as part of an ongoing " +
        "experiment.",
      normalizedContent:
        "Feature flag 'new-tax-calculation' enabled for 5% of traffic as part of an ongoing " +
        "experiment.",
      timestamp: '2026-06-14T14:00:00Z',
      lineNumber: null,
      metadata: { flag: 'new-tax-calculation', rolloutPct: 5 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-12`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        'checkout-api pod count auto-scaled from 10 to 14 due to sustained CPU pressure.',
      normalizedContent:
        'checkout-api pod count auto-scaled from 10 to 14 due to sustained CPU pressure.',
      timestamp: '2026-06-14T14:39:00Z',
      lineNumber: null,
      metadata: { metric: 'pod_count', from: 10, to: 14 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-13`,
      incidentId: INCIDENT_ID,
      sourceType: 'support-message',
      sourceName: 'On-call engineer notes',
      originalContent:
        'This same connection-timeout error signature has appeared briefly a few times over the ' +
        'past month, always self-resolving within minutes with no deploy involved. Exact prior ' +
        'dates were not logged anywhere searchable.',
      normalizedContent:
        'This same connection-timeout error signature has appeared briefly a few times over the ' +
        'past month, always self-resolving within minutes with no deploy involved. Exact prior ' +
        'dates were not logged anywhere searchable.',
      timestamp: null,
      lineNumber: null,
      metadata: { priorOccurrences: 'a few', timeframe: 'past month' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-14`,
      incidentId: INCIDENT_ID,
      sourceType: 'other',
      sourceName: 'Observability gap note',
      originalContent:
        'Per-request database-connection-hold-time metrics are not currently instrumented for ' +
        'checkout-api, so it is not possible to directly confirm from existing dashboards whether ' +
        'individual requests are holding connections for longer than before the deploy.',
      normalizedContent:
        'Per-request database-connection-hold-time metrics are not currently instrumented for ' +
        'checkout-api, so it is not possible to directly confirm from existing dashboards whether ' +
        'individual requests are holding connections for longer than before the deploy.',
      timestamp: null,
      lineNumber: null,
      metadata: { gap: 'connection-hold-time metrics not instrumented' },
      createdAt: DETECTED_AT,
    },
  ],
};
