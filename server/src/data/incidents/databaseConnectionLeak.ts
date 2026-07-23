import type { Incident } from '../../../../shared/types/incident.js';

const INCIDENT_ID = 'sample-db-connection-leak';
const DETECTED_AT = '2026-07-15T10:12:00Z';

/**
 * Sample incident: order-service requests intermittently failing with
 * database connection-pool exhaustion. Deliberately ambiguous between two
 * competing, non-exclusive explanations that both started around the same
 * time -- a same-day deploy that reworked how DB sessions are scoped per
 * request (a plausible leak on an exception path), and a genuine traffic
 * increase from a marketing campaign that alone could saturate the pool
 * with no code defect at all -- plus a base-rate-neglect trap (this pool
 * has alarmed intermittently before, unrelated to any deploy) and an
 * unrelated routine-maintenance red herring. The pool's configured max
 * size was deliberately left unchanged in the deploy, so the "the deploy
 * simply shrank the pool" explanation (already used by the bundled
 * ecommerce-checkout sample) does not apply here -- ruling it out requires
 * reading the evidence, not just noticing "deploy happened, pool alert
 * fired".
 */
export const databaseConnectionLeakIncident: Incident = {
  id: INCIDENT_ID,
  title: 'Order service failing with database connection-pool exhaustion',
  description:
    'orders-service has been intermittently returning 500 errors since roughly 09:40 UTC, with ' +
    'logs pointing to database connection-pool exhaustion. A deploy shipped shortly before ' +
    'reports started; a marketing campaign also drove a traffic increase around the same time.',
  scenarioType: 'database-connection-leak',
  status: 'draft',
  severity: 'high',
  affectedService: 'orders-service',
  startedAt: '2026-07-15T09:40:00Z',
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
        'orders-service has been intermittently returning 500 errors since roughly 09:40 UTC, ' +
        'with logs pointing to database connection-pool exhaustion. A deploy shipped shortly ' +
        'before reports started; a marketing campaign also drove a traffic increase around the ' +
        'same time.',
      normalizedContent:
        'orders-service has been intermittently returning 500 errors since roughly 09:40 UTC, ' +
        'with logs pointing to database connection-pool exhaustion. A deploy shipped shortly ' +
        'before reports started; a marketing campaign also drove a traffic increase around the ' +
        'same time.',
      timestamp: DETECTED_AT,
      lineNumber: null,
      metadata: {},
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-02`,
      incidentId: INCIDENT_ID,
      sourceType: 'deployment-note',
      sourceName: 'deploy-log-orders-service',
      originalContent:
        'orders-service deployed v5.2.0 at 09:35 UTC: refactored the repository layer to use ' +
        'request-scoped database sessions via the new ORM session manager. DB connection pool ' +
        'max size unchanged at 30 per pod. Also included minor logging improvements.',
      normalizedContent:
        'orders-service deployed v5.2.0 at 09:35 UTC: refactored the repository layer to use ' +
        'request-scoped database sessions via the new ORM session manager. DB connection pool ' +
        'max size unchanged at 30 per pod. Also included minor logging improvements.',
      timestamp: '2026-07-15T09:35:00Z',
      lineNumber: null,
      metadata: { version: 'v5.2.0', service: 'orders-service', poolMaxSize: 30, poolMaxSizeChanged: false },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-03`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        'orders-db connection-pool utilization climbed steadily from 42% at 09:40 UTC to 100% ' +
        'at 10:05 UTC, then stayed pinned near 100% -- a gradual rise over 25 minutes, not a ' +
        'sudden spike.',
      normalizedContent:
        'orders-db connection-pool utilization climbed steadily from 42% at 09:40 UTC to 100% ' +
        'at 10:05 UTC, then stayed pinned near 100% -- a gradual rise over 25 minutes, not a ' +
        'sudden spike.',
      timestamp: '2026-07-15T10:05:00Z',
      lineNumber: null,
      metadata: { metric: 'pool_utilization_pct', from: 42, to: 100, windowMinutes: 25 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-04`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Marketing analytics dashboard',
      originalContent:
        'orders-service request volume up 35% starting 09:30 UTC, coinciding with a promotional ' +
        'email campaign sent to 400k subscribers at 09:28 UTC.',
      normalizedContent:
        'orders-service request volume up 35% starting 09:30 UTC, coinciding with a promotional ' +
        'email campaign sent to 400k subscribers at 09:28 UTC.',
      timestamp: '2026-07-15T09:30:00Z',
      lineNumber: null,
      metadata: { metric: 'request_volume_pct_change', value: 35, campaign: 'summer-promo' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-05`,
      incidentId: INCIDENT_ID,
      sourceType: 'api-error',
      sourceName: 'orders-api-error.log',
      originalContent:
        "POST /api/orders -- 63 failures between 09:50 and 10:15 UTC. Error: 'connection pool " +
        "exhausted, timed out waiting 5000ms for available connection'.",
      normalizedContent:
        "POST /api/orders -- 63 failures between 09:50 and 10:15 UTC. Error: 'connection pool " +
        "exhausted, timed out waiting 5000ms for available connection'.",
      timestamp: '2026-07-15T09:50:00Z',
      lineNumber: 271,
      metadata: { httpStatus: 500, count: 63 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-06`,
      incidentId: INCIDENT_ID,
      sourceType: 'database-error',
      sourceName: 'postgres-orders-primary.log',
      originalContent:
        'FATAL: remaining connection slots are reserved for non-replication superuser ' +
        'connections -- logged 19 times between 09:52 and 10:20 UTC.',
      normalizedContent:
        'FATAL: remaining connection slots are reserved for non-replication superuser ' +
        'connections -- logged 19 times between 09:52 and 10:20 UTC.',
      timestamp: '2026-07-15T09:52:00Z',
      lineNumber: 1440,
      metadata: { database: 'orders-primary', count: 19 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-07`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'orders-service.log',
      originalContent:
        'INFO: "session closed" log line frequency dropped from ~48/min (pre-deploy baseline) ' +
        'to ~11/min after 09:35 UTC, while "session opened" frequency stayed roughly constant.',
      normalizedContent:
        'INFO: "session closed" log line frequency dropped from ~48/min (pre-deploy baseline) ' +
        'to ~11/min after 09:35 UTC, while "session opened" frequency stayed roughly constant.',
      timestamp: '2026-07-15T09:45:00Z',
      lineNumber: 3390,
      metadata: { level: 'INFO', sessionsClosedPerMinBefore: 48, sessionsClosedPerMinAfter: 11 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-08`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      originalContent:
        'Scheduled autovacuum began on the orders_history table at 09:41 UTC, elevating disk ' +
        'I/O wait on the orders-db replica (not the primary) for its usual ~40 minute duration.',
      normalizedContent:
        'Scheduled autovacuum began on the orders_history table at 09:41 UTC, elevating disk ' +
        'I/O wait on the orders-db replica (not the primary) for its usual ~40 minute duration.',
      timestamp: '2026-07-15T09:41:00Z',
      lineNumber: null,
      metadata: { metric: 'io_wait', table: 'orders_history', target: 'replica' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-09`,
      incidentId: INCIDENT_ID,
      sourceType: 'user-report',
      sourceName: 'Support ticket queue',
      originalContent:
        "8 tickets between 09:55 and 10:20 UTC: most mention the order eventually going through " +
        "on a second or third attempt, e.g. 'had to try 3 times but it worked eventually', " +
        "'checkout hung then failed, retried and it was fine'.",
      normalizedContent:
        "8 tickets between 09:55 and 10:20 UTC: most mention the order eventually going through " +
        "on a second or third attempt, e.g. 'had to try 3 times but it worked eventually', " +
        "'checkout hung then failed, retried and it was fine'.",
      timestamp: '2026-07-15T09:55:00Z',
      lineNumber: null,
      metadata: { ticketCount: 8 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-10`,
      incidentId: INCIDENT_ID,
      sourceType: 'support-message',
      sourceName: 'On-call engineer notes',
      originalContent:
        'This same connection-pool-utilization alert has fired sporadically 3-4 times over the ' +
        'past two months, always self-resolving within an hour with no deploy involved. Exact ' +
        'prior dates were not logged anywhere searchable.',
      normalizedContent:
        'This same connection-pool-utilization alert has fired sporadically 3-4 times over the ' +
        'past two months, always self-resolving within an hour with no deploy involved. Exact ' +
        'prior dates were not logged anywhere searchable.',
      timestamp: null,
      lineNumber: null,
      metadata: { priorOccurrences: '3-4', timeframe: 'past two months' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-11`,
      incidentId: INCIDENT_ID,
      sourceType: 'other',
      sourceName: 'Observability gap note',
      originalContent:
        'Per-request connection-hold-time metrics are not currently instrumented for ' +
        'orders-service, so it is not possible to directly confirm from existing dashboards ' +
        'whether individual requests are holding connections for longer than before the deploy.',
      normalizedContent:
        'Per-request connection-hold-time metrics are not currently instrumented for ' +
        'orders-service, so it is not possible to directly confirm from existing dashboards ' +
        'whether individual requests are holding connections for longer than before the deploy.',
      timestamp: null,
      lineNumber: null,
      metadata: { gap: 'connection-hold-time metrics not instrumented' },
      createdAt: DETECTED_AT,
    },
  ],
};
