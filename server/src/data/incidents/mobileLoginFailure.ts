import type { Incident } from '../../../../shared/types/incident.js';

const INCIDENT_ID = 'sample-mobile-login';
const DETECTED_AT = '2026-07-09T08:10:00Z';

/**
 * Sample incident: intermittent mobile login failures affecting only a
 * subset of users. Evidence supports two overlapping, non-exclusive
 * explanations -- a cache-eviction bug during a JWT signing-key rotation,
 * and a stale token-refresh implementation in older app versions -- plus
 * one red herring (an unrelated push-notification certificate error) that
 * could anchor an investigator on the wrong "auth-adjacent" problem.
 */
export const mobileLoginFailureIncident: Incident = {
  id: INCIDENT_ID,
  title: 'Mobile app login failing for a subset of users',
  description:
    'Since yesterday evening, a subset of mobile app users report being unable to log in, ' +
    'seeing "Session could not be verified". Web login is unaffected. The issue appears ' +
    'intermittent rather than universal.',
  scenarioType: 'mobile-login-failure',
  status: 'draft',
  severity: 'medium',
  affectedService: 'auth-service',
  startedAt: '2026-07-08T19:00:00Z',
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
        'Since yesterday evening, a subset of mobile app users report being unable to log in, ' +
        'seeing "Session could not be verified". Web login is unaffected. The issue appears ' +
        'intermittent rather than universal.',
      normalizedContent:
        'Since yesterday evening, a subset of mobile app users report being unable to log in, ' +
        'seeing "Session could not be verified". Web login is unaffected. The issue appears ' +
        'intermittent rather than universal.',
      timestamp: DETECTED_AT,
      lineNumber: null,
      metadata: {},
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-02`,
      incidentId: INCIDENT_ID,
      sourceType: 'user-report',
      sourceName: 'App store reviews',
      originalContent:
        '23 App Store / Play Store reviews in the last 18 hours mention login failures, mostly ' +
        'from users on iOS app version 4.8.0 and below.',
      normalizedContent:
        '23 App Store / Play Store reviews in the last 18 hours mention login failures, mostly ' +
        'from users on iOS app version 4.8.0 and below.',
      timestamp: '2026-07-09T07:30:00Z',
      lineNumber: null,
      metadata: { reviewCount: 23 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-03`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'auth-service.log',
      originalContent:
        "WARN: JWT signature verification failed -- logged 340 times between 19:00 and 08:00, " +
        "all from client version header < 4.9.0.",
      normalizedContent:
        "WARN: JWT signature verification failed -- logged 340 times between 19:00 and 08:00, " +
        "all from client version header < 4.9.0.",
      timestamp: '2026-07-08T19:05:00Z',
      lineNumber: 1204,
      metadata: { level: 'WARN', count: 340, clientVersionLessThan: '4.9.0' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-04`,
      incidentId: INCIDENT_ID,
      sourceType: 'deployment-note',
      sourceName: 'deploy-log-auth-service',
      originalContent:
        'auth-service deployed v3.12.0 at 18:45 UTC: rotated JWT signing key as part of ' +
        'scheduled quarterly security rotation. Old key retained in the verification allow-list ' +
        'for a 24h grace period per runbook.',
      normalizedContent:
        'auth-service deployed v3.12.0 at 18:45 UTC: rotated JWT signing key as part of ' +
        'scheduled quarterly security rotation. Old key retained in the verification allow-list ' +
        'for a 24h grace period per runbook.',
      timestamp: '2026-07-08T18:45:00Z',
      lineNumber: null,
      metadata: { version: 'v3.12.0', service: 'auth-service' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-05`,
      incidentId: INCIDENT_ID,
      sourceType: 'api-error',
      sourceName: 'mobile-gateway.log',
      originalContent:
        '401 Unauthorized responses for POST /auth/verify-session -- 12% of requests between ' +
        '19:00 yesterday and 08:00 today (baseline < 0.5%).',
      normalizedContent:
        '401 Unauthorized responses for POST /auth/verify-session -- 12% of requests between ' +
        '19:00 yesterday and 08:00 today (baseline < 0.5%).',
      timestamp: '2026-07-08T19:10:00Z',
      lineNumber: 89,
      metadata: { httpStatus: 401, errorRatePct: 12, baselinePct: 0.5 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-06`,
      incidentId: INCIDENT_ID,
      sourceType: 'application-log',
      sourceName: 'auth-service.log',
      originalContent:
        'INFO: grace-period signing-key cache miss rate 34% during rotation window (expected ' +
        '< 5%) -- cache eviction under memory pressure suspected.',
      normalizedContent:
        'INFO: grace-period signing-key cache miss rate 34% during rotation window (expected ' +
        '< 5%) -- cache eviction under memory pressure suspected.',
      timestamp: '2026-07-08T19:20:00Z',
      lineNumber: 1250,
      metadata: { level: 'INFO', cacheMissRatePct: 34, expectedPct: 5 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-07`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'Infrastructure dashboard',
      originalContent:
        'auth-service pod memory usage spiked to 92% (baseline 60%) between 19:10 and 20:00 UTC, ' +
        'coinciding with the key-rotation deploy.',
      normalizedContent:
        'auth-service pod memory usage spiked to 92% (baseline 60%) between 19:10 and 20:00 UTC, ' +
        'coinciding with the key-rotation deploy.',
      timestamp: '2026-07-08T19:10:00Z',
      lineNumber: null,
      metadata: { metric: 'memory_pct', value: 92, baseline: 60 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-08`,
      incidentId: INCIDENT_ID,
      sourceType: 'support-message',
      sourceName: 'Support notes',
      originalContent:
        'Affected users who force-quit and reopened the app were sometimes able to log in ' +
        'successfully afterward.',
      normalizedContent:
        'Affected users who force-quit and reopened the app were sometimes able to log in ' +
        'successfully afterward.',
      timestamp: '2026-07-09T07:00:00Z',
      lineNumber: null,
      metadata: {},
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-09`,
      incidentId: INCIDENT_ID,
      sourceType: 'error-trace',
      sourceName: 'mobile-push-notification-service.log',
      originalContent: "ERROR: APNs certificate expired.",
      normalizedContent: "ERROR: APNs certificate expired.",
      timestamp: '2026-07-09T03:00:00Z',
      lineNumber: 45,
      metadata: { level: 'ERROR', service: 'mobile-push-notification-service' },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-10`,
      incidentId: INCIDENT_ID,
      sourceType: 'deployment-note',
      sourceName: 'App store release notes',
      originalContent:
        'iOS app version 4.9.0 released 3 days ago includes updated token-refresh logic; ' +
        'adoption at 61% of active users as of today.',
      normalizedContent:
        'iOS app version 4.9.0 released 3 days ago includes updated token-refresh logic; ' +
        'adoption at 61% of active users as of today.',
      timestamp: '2026-07-06T12:00:00Z',
      lineNumber: null,
      metadata: { version: '4.9.0', adoptionPct: 61 },
      createdAt: DETECTED_AT,
    },
    {
      id: `${INCIDENT_ID}-ev-11`,
      incidentId: INCIDENT_ID,
      sourceType: 'monitoring-alert',
      sourceName: 'auth-service error-rate-by-client dashboard',
      originalContent:
        'Error rate by client version (snapshot 08:00 UTC): v4.8.x and below = 14% error rate; ' +
        'v4.9.0+ = 0.2% error rate.',
      normalizedContent:
        'Error rate by client version (snapshot 08:00 UTC): v4.8.x and below = 14% error rate; ' +
        'v4.9.0+ = 0.2% error rate.',
      timestamp: '2026-07-09T08:00:00Z',
      lineNumber: null,
      metadata: { errorRateOldClientsPct: 14, errorRateNewClientsPct: 0.2 },
      createdAt: DETECTED_AT,
    },
  ],
};
