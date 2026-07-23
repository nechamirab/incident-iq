import type { ScenarioEvaluationFixture } from './types.js';

const ID = 'sample-course-registration';

/**
 * Evaluation fixture for {@link courseRegistrationSlowdownIncident} (one of
 * the three original bundled scenarios). See `types.ts` for what this is
 * (and is not) used for.
 */
export const courseRegistrationSlowdownEvaluation: ScenarioEvaluationFixture = {
  incidentId: ID,
  expectedFacts: [
    {
      statement: 'Students reported the registration portal was extremely slow or timing out between 09:00 and 09:35 UTC.',
      evidenceIds: [`${ID}-ev-01`],
    },
    {
      statement: 'registration-service p99 latency reached 12000ms (threshold 2000ms) at 09:00 UTC.',
      evidenceIds: [`${ID}-ev-02`],
    },
    {
      statement: 'registration-service logged thread-pool-exhausted warnings repeatedly between 09:02 and 09:30 UTC.',
      evidenceIds: [`${ID}-ev-03`],
    },
    {
      statement: 'A slow query against course_catalog_db took 8400ms and was logged 42 times between 09:03 and 09:28 UTC.',
      evidenceIds: [`${ID}-ev-04`],
    },
    {
      statement: 'There were no deployments to registration-service in the 7 days before the incident.',
      evidenceIds: [`${ID}-ev-05`],
    },
    {
      statement: 'registration-service CPU utilization reached 96% across all 6 pods between 09:01 and 09:32 UTC.',
      evidenceIds: [`${ID}-ev-06`],
    },
    {
      statement: 'Active session count peaked at 8400 concurrent users at 09:05 UTC, versus a previous peak of 3200.',
      evidenceIds: [`${ID}-ev-08`],
    },
    {
      statement: 'A reminder email was sent to 15,000 students at 08:50 UTC about registration opening at 09:00 UTC.',
      evidenceIds: [`${ID}-ev-09`],
    },
    {
      statement: 'The registration-service connection pool reached 100% utilization (50/50) between 09:04 and 09:29 UTC.',
      evidenceIds: [`${ID}-ev-10`],
    },
  ],
  mustNotBePresentedAsFacts: [
    'The traffic spike from the marketing email alone caused the slowdown.',
    'The slow database query is the root cause.',
    'The CDN cache-hit-ratio drop from the frontend deploy caused or contributed to the backend slowdown.',
  ],
  plausibleHypotheses: [
    {
      id: 'traffic-surge',
      summary:
        'The marketing reminder email drove a 2.6x session spike (8400 vs 3200 baseline) that ' +
        "exceeded registration-service's normal capacity.",
      supportingEvidenceIds: [`${ID}-ev-09`, `${ID}-ev-08`, `${ID}-ev-06`],
      contradictingEvidenceIds: [`${ID}-ev-04`],
    },
    {
      id: 'query-performance',
      summary:
        'An inefficient query against course_catalog_db becomes disproportionately slow under ' +
        'concurrent load, exhausting the connection pool and thread pool regardless of absolute ' +
        'traffic level.',
      supportingEvidenceIds: [`${ID}-ev-04`, `${ID}-ev-10`, `${ID}-ev-03`],
      contradictingEvidenceIds: [`${ID}-ev-05`],
    },
    {
      id: 'combined-load-and-query',
      summary:
        'Normal capacity, sized for typical load, was overwhelmed specifically because the slow ' +
        "query's cost scales poorly with the 2.6x concurrent-session spike -- neither factor alone " +
        'fully explains the severity.',
      supportingEvidenceIds: [`${ID}-ev-08`, `${ID}-ev-04`, `${ID}-ev-10`],
      contradictingEvidenceIds: [],
    },
    {
      id: 'cdn-decoy',
      summary: 'The CDN cache-hit-ratio drop caused the registration slowdown.',
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [`${ID}-ev-11`],
    },
  ],
  challengingEvidenceIdsForLeadingExplanation: [`${ID}-ev-04`, `${ID}-ev-05`, `${ID}-ev-12`],
  expectedReasoningRisks: ['base-rate-neglect', 'confirmation-bias', 'availability-bias', 'post-hoc-fallacy'],
  distractingEvidenceIds: [`${ID}-ev-11`],
  missingInformationEvidenceIds: [`${ID}-ev-13`],
  approximateOrInferredEvidenceIds: [`${ID}-ev-12`, `${ID}-ev-13`],
  openQuestions: [
    'Would the slow query have caused this severity of slowdown without the traffic spike, or vice versa?',
    'Was the slow query pattern seen today different from its normal execution plan, or the same plan under higher load?',
    'Were prior registration-opening slowdowns in past semesters ever traced to the same query or a different cause?',
  ],
};
