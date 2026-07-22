import type { Incident } from '../../../../shared/types/incident.js';

const INCIDENT_ID = 'sample-course-registration';
const DETECTED_AT = '2026-05-18T09:15:00Z';

/**
 * Sample incident: severe slowdown (not an outage) during a course
 * registration opening window. Evidence mixes a plausible capacity/traffic
 * explanation (a marketing reminder email driving a 2.6x session spike)
 * with a plausible query-performance explanation (slow queries, exhausted
 * DB connection pool), plus a red herring (an unrelated frontend deploy
 * that hurt CDN cache hit rate) and an explicit fact ruling out a recent
 * backend deploy as the cause.
 */
export const courseRegistrationSlowdownIncident: Incident = {
  id: INCIDENT_ID,
  title: 'Course registration portal slow during Fall semester registration opening',
  description:
    'Students report the course registration portal is extremely slow or timing out between ' +
    '09:00 and 09:35 UTC, the scheduled opening time for Fall semester registration. No outright ' +
    'errors are being returned -- pages are just very slow or hang indefinitely.',
  scenarioType: 'course-registration-slowdown',
  status: 'draft',
  severity: 'high',
  affectedService: 'registration-service',
  startedAt: '2026-05-18T09:00:00Z',
  detectedAt: DETECTED_AT,
  resolvedAt: null,
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
        'Students report the course registration portal is extremely slow or timing out between ' +
        '09:00 and 09:35 UTC, the scheduled opening time for Fall semester registration. No ' +
        'outright errors are being returned -- pages are just very slow or hang indefinitely.',
      normalizedContent:
        'Students report the course registration portal is extremely slow or timing out between ' +
        '09:00 and 09:35 UTC, the scheduled opening time for Fall semester registration. No ' +
        'outright errors are being returned -- pages are just very slow or hang indefinitely.',
      timestamp: DETECTED_AT,
      lineNumber: null,
      metadata: {},
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-02`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'API gateway',
      originalContent:
        'registration-service p99 latency reached 12000ms (threshold 2000ms) at 09:00 UTC, ' +
        'sustained until 09:35 UTC.',
      normalizedContent:
        'registration-service p99 latency reached 12000ms (threshold 2000ms) at 09:00 UTC, ' +
        'sustained until 09:35 UTC.',
      timestamp: '2026-05-18T09:00:00Z',
      lineNumber: null,
      metadata: { metric: 'p99_latency_ms', value: 12000, threshold: 2000 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-03`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'registration-service.log',
      originalContent: "WARN: thread pool exhausted, queuing requests -- repeated 09:02-09:30 UTC.",
      normalizedContent:
        "WARN: thread pool exhausted, queuing requests -- repeated 09:02-09:30 UTC.",
      timestamp: '2026-05-18T09:02:00Z',
      lineNumber: 561,
      metadata: { level: 'WARN' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-04`,
      incidentId: INCIDENT_ID,
      sourceType: 'database-error',
      sourceName: 'course_catalog_db slow query log',
      originalContent:
        "slow query: SELECT * FROM sections WHERE term = 'fall-2026' AND seats_available > 0 " +
        "took 8400ms -- logged 42 times between 09:03 and 09:28 UTC.",
      normalizedContent:
        "slow query: SELECT * FROM sections WHERE term = 'fall-2026' AND seats_available > 0 " +
        "took 8400ms -- logged 42 times between 09:03 and 09:28 UTC.",
      timestamp: '2026-05-18T09:03:00Z',
      lineNumber: 77,
      metadata: { durationMs: 8400, count: 42 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-05`,
      incidentId: INCIDENT_ID,
      sourceType: 'deployment-note',
      sourceName: 'deploy-log-registration-service',
      originalContent: 'No deployments to registration-service in the last 7 days.',
      normalizedContent: 'No deployments to registration-service in the last 7 days.',
      timestamp: '2026-05-18T08:00:00Z',
      lineNumber: null,
      metadata: { service: 'registration-service' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-06`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Infrastructure dashboard',
      originalContent:
        'registration-service CPU utilization at 96% sustained across all 6 pods, 09:01-09:32 UTC.',
      normalizedContent:
        'registration-service CPU utilization at 96% sustained across all 6 pods, 09:01-09:32 UTC.',
      timestamp: '2026-05-18T09:01:00Z',
      lineNumber: null,
      metadata: { metric: 'cpu_pct', value: 96, podCount: 6 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-07`,
      incidentId: INCIDENT_ID,
      sourceType: 'user-report',
      sourceName: 'Support ticket queue',
      originalContent:
        "142 tickets logged between 09:00 and 09:40 UTC referencing 'stuck loading', 'times " +
        "out', 'spinning wheel'.",
      normalizedContent:
        "142 tickets logged between 09:00 and 09:40 UTC referencing 'stuck loading', 'times " +
        "out', 'spinning wheel'.",
      timestamp: '2026-05-18T09:10:00Z',
      lineNumber: null,
      metadata: { ticketCount: 142 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-08`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'registration-service.log',
      originalContent:
        'INFO: active session count peaked at 8400 concurrent users at 09:05 UTC (previous peak: 3200).',
      normalizedContent:
        'INFO: active session count peaked at 8400 concurrent users at 09:05 UTC (previous peak: 3200).',
      timestamp: '2026-05-18T09:05:00Z',
      lineNumber: 612,
      metadata: { level: 'INFO', peakSessions: 8400, previousPeak: 3200 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-09`,
      incidentId: INCIDENT_ID,
      sourceType: 'other',
      sourceName: 'Marketing send log',
      originalContent:
        'Reminder email sent to 15,000 students at 08:50 UTC about registration opening at 09:00 UTC.',
      normalizedContent:
        'Reminder email sent to 15,000 students at 08:50 UTC about registration opening at 09:00 UTC.',
      timestamp: '2026-05-18T08:50:00Z',
      lineNumber: null,
      metadata: { recipientCount: 15000 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-10`,
      incidentId: INCIDENT_ID,
      sourceType: 'database-error',
      sourceName: 'course_catalog_db connection pool metrics',
      originalContent:
        'Connection pool for registration-service at 100% utilization (50/50) between 09:04 and 09:29 UTC.',
      normalizedContent:
        'Connection pool for registration-service at 100% utilization (50/50) between 09:04 and 09:29 UTC.',
      timestamp: '2026-05-18T09:04:00Z',
      lineNumber: null,
      metadata: { poolSize: 50, poolUsed: 50 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-11`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'CDN dashboard',
      originalContent:
        'Cache hit ratio for /registration static assets dropped to 40% (baseline 92%) at 09:01 ' +
        'UTC, following a cache-busting query string change shipped in yesterday’s frontend deploy.',
      normalizedContent:
        'Cache hit ratio for /registration static assets dropped to 40% (baseline 92%) at 09:01 ' +
        'UTC, following a cache-busting query string change shipped in yesterday’s frontend deploy.',
      timestamp: '2026-05-18T09:01:00Z',
      lineNumber: null,
      metadata: { metric: 'cache_hit_ratio_pct', value: 40, baseline: 92 },
      createdAt: DETECTED_AT,
    },
  ],
};
