import type { Incident } from '../../../../shared/types/incident.js';

const INCIDENT_ID = 'sample-async-queue-backlog';
const DETECTED_AT = '2026-07-20T13:30:00Z';

/**
 * Sample incident: the order-fulfillment queue backlog is growing and
 * order-confirmation emails are arriving hours late. Deliberately supports
 * three non-exclusive causes -- a same-day consumer pod count reduction
 * (offset by a concurrency increase, so its net effect on capacity is not
 * obvious), a batch of malformed messages repeatedly failing and consuming
 * retry cycles, and a slowed downstream dependency each consumer call
 * blocks on -- with producer throughput explicitly confirmed normal to
 * rule out "too many messages produced" as the cause. An unrelated,
 * suspiciously-well-timed CPU spike from a different workload in the same
 * namespace is included as a post-hoc-fallacy trap, and the alert's fire
 * time is explicitly called out as lagging the backlog's true onset, as a
 * hindsight/anchoring trap.
 */
export const asyncQueueBacklogIncident: Incident = {
  id: INCIDENT_ID,
  title: 'Order-fulfillment queue backlog delaying order confirmations',
  description:
    'The order-fulfillment queue has been backing up since sometime this morning, and customers ' +
    'are now receiving order-confirmation emails hours late. Queue depth continues to grow. ' +
    'Producer-side (order creation) throughput looks normal.',
  scenarioType: 'async-queue-backlog',
  status: 'draft',
  severity: 'medium',
  affectedService: 'order-fulfillment-consumer',
  startedAt: '2026-07-20T08:00:00Z',
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
        'The order-fulfillment queue has been backing up since sometime this morning, and ' +
        'customers are now receiving order-confirmation emails hours late. Queue depth ' +
        'continues to grow. Producer-side (order creation) throughput looks normal.',
      normalizedContent:
        'The order-fulfillment queue has been backing up since sometime this morning, and ' +
        'customers are now receiving order-confirmation emails hours late. Queue depth ' +
        'continues to grow. Producer-side (order creation) throughput looks normal.',
      timestamp: DETECTED_AT,
      lineNumber: null,
      metadata: {},
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-02`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        'order-fulfillment queue depth grew from a baseline of ~200 messages to 15,400 messages ' +
        'between 08:00 and 13:15 UTC. Alert threshold (5,000) was crossed at 11:20 UTC.',
      normalizedContent:
        'order-fulfillment queue depth grew from a baseline of ~200 messages to 15,400 messages ' +
        'between 08:00 and 13:15 UTC. Alert threshold (5,000) was crossed at 11:20 UTC.',
      timestamp: '2026-07-20T13:15:00Z',
      lineNumber: null,
      metadata: { metric: 'queue_depth', from: 200, to: 15400, alertThreshold: 5000, alertFiredAt: '2026-07-20T11:20:00Z' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-03`,
      incidentId: INCIDENT_ID,
      sourceType: 'deployment-note',
      sourceName: 'deploy-log-order-fulfillment-consumer',
      originalContent:
        'order-fulfillment-consumer deployed v2.1.0 at 07:50 UTC: reduced consumer pod count ' +
        'from 12 to 6 as a cost-optimization pass, and increased per-pod concurrency from 4 to ' +
        '8 to compensate. Net theoretical concurrent-processing capacity: 48 before, 48 after.',
      normalizedContent:
        'order-fulfillment-consumer deployed v2.1.0 at 07:50 UTC: reduced consumer pod count ' +
        'from 12 to 6 as a cost-optimization pass, and increased per-pod concurrency from 4 to ' +
        '8 to compensate. Net theoretical concurrent-processing capacity: 48 before, 48 after.',
      timestamp: '2026-07-20T07:50:00Z',
      lineNumber: null,
      metadata: { version: 'v2.1.0', podsBefore: 12, podsAfter: 6, concurrencyBefore: 4, concurrencyAfter: 8 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-04`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        '247 messages moved to the dead-letter-queue between 08:10 and 13:00 UTC after ' +
        'exceeding the 5-attempt retry limit.',
      normalizedContent:
        '247 messages moved to the dead-letter-queue between 08:10 and 13:00 UTC after ' +
        'exceeding the 5-attempt retry limit.',
      timestamp: '2026-07-20T13:00:00Z',
      lineNumber: null,
      metadata: { metric: 'dead_letter_count', value: 247, retryLimit: 5 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-05`,
      incidentId: INCIDENT_ID,
      sourceType: 'error-trace',
      sourceName: 'order-fulfillment-consumer.log',
      originalContent:
        "ERROR: NullPointerException in ShippingAddressNormalizer.normalize() -- message id " +
        "ord-8841 retried 5 times between 08:12 and 08:41 UTC, all attempts failing with the " +
        "same error, before moving to the dead-letter queue. 62 other message ids show the " +
        "identical stack trace.",
      normalizedContent:
        "ERROR: NullPointerException in ShippingAddressNormalizer.normalize() -- message id " +
        "ord-8841 retried 5 times between 08:12 and 08:41 UTC, all attempts failing with the " +
        "same error, before moving to the dead-letter queue. 62 other message ids show the " +
        "identical stack trace.",
      timestamp: '2026-07-20T08:12:00Z',
      lineNumber: 552,
      metadata: { errorType: 'NullPointerException', affectedMessageCount: 63, retriesEach: 5 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-06`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        'shipping-rate-api (called once per message during processing) p95 latency rose from ' +
        '180ms baseline to 2,400ms between 08:30 and 13:15 UTC, still ongoing.',
      normalizedContent:
        'shipping-rate-api (called once per message during processing) p95 latency rose from ' +
        '180ms baseline to 2,400ms between 08:30 and 13:15 UTC, still ongoing.',
      timestamp: '2026-07-20T08:30:00Z',
      lineNumber: null,
      metadata: { metric: 'p95_latency_ms', baseline: 180, value: 2400, service: 'shipping-rate-api' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-07`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        'order-creation (producer) throughput: 210-240 messages/hour between 08:00 and 13:15 ' +
        'UTC, matching the 200-250/hour baseline for this day of week. No unusual spike.',
      normalizedContent:
        'order-creation (producer) throughput: 210-240 messages/hour between 08:00 and 13:15 ' +
        'UTC, matching the 200-250/hour baseline for this day of week. No unusual spike.',
      timestamp: '2026-07-20T13:15:00Z',
      lineNumber: null,
      metadata: { metric: 'producer_throughput_per_hour', min: 210, max: 240, baselineMin: 200, baselineMax: 250 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-08`,
      incidentId: INCIDENT_ID,
      sourceType: 'user-report',
      sourceName: 'Support ticket queue',
      originalContent:
        "11 tickets between 11:30 and 13:20 UTC: 'ordered 4 hours ago, still no confirmation " +
        "email', 'order status still shows processing', 'did my order actually go through?'.",
      normalizedContent:
        "11 tickets between 11:30 and 13:20 UTC: 'ordered 4 hours ago, still no confirmation " +
        "email', 'order status still shows processing', 'did my order actually go through?'.",
      timestamp: '2026-07-20T11:30:00Z',
      lineNumber: null,
      metadata: { ticketCount: 11 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-09`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        'Unrelated: the nightly analytics ETL job (different namespace, different node pool) ' +
        'briefly spiked cluster-wide node CPU to 88% at 08:05 UTC for about 6 minutes, as it ' +
        'does most mornings.',
      normalizedContent:
        'Unrelated: the nightly analytics ETL job (different namespace, different node pool) ' +
        'briefly spiked cluster-wide node CPU to 88% at 08:05 UTC for about 6 minutes, as it ' +
        'does most mornings.',
      timestamp: '2026-07-20T08:05:00Z',
      lineNumber: null,
      metadata: { metric: 'node_cpu_pct', value: 88, source: 'analytics-etl', namespace: 'data-platform' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-10`,
      incidentId: INCIDENT_ID,
      sourceType: 'other',
      sourceName: 'Observability gap note',
      originalContent:
        'Per-message processing-duration histograms are only retained for 1 hour, so it is not ' +
        'possible to directly compare this morning\'s per-message processing time against the ' +
        'pre-deploy baseline from before 07:50 UTC.',
      normalizedContent:
        'Per-message processing-duration histograms are only retained for 1 hour, so it is not ' +
        'possible to directly compare this morning\'s per-message processing time against the ' +
        'pre-deploy baseline from before 07:50 UTC.',
      timestamp: null,
      lineNumber: null,
      metadata: { gap: 'processing-duration histograms retained only 1 hour' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-11`,
      incidentId: INCIDENT_ID,
      sourceType: 'support-message',
      sourceName: 'On-call engineer notes',
      originalContent:
        'The queue-depth alert only fires once the 5,000-message threshold is crossed, which ' +
        'happened at 11:20 UTC -- but the depth graph shows growth had already been underway ' +
        'for hours before that, so the alert time should not be treated as the actual onset.',
      normalizedContent:
        'The queue-depth alert only fires once the 5,000-message threshold is crossed, which ' +
        'happened at 11:20 UTC -- but the depth graph shows growth had already been underway ' +
        'for hours before that, so the alert time should not be treated as the actual onset.',
      timestamp: null,
      lineNumber: null,
      metadata: { alertFiredAt: '2026-07-20T11:20:00Z' },
      createdAt: DETECTED_AT,
    },
  ],
};
