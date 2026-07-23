import type { ScenarioEvaluationFixture } from './types.js';

const ID = 'sample-mobile-login';

/**
 * Evaluation fixture for {@link mobileLoginFailureIncident} (one of the
 * three original bundled scenarios). See `types.ts` for what this is (and
 * is not) used for.
 */
export const mobileLoginFailureEvaluation: ScenarioEvaluationFixture = {
  incidentId: ID,
  expectedFacts: [
    {
      statement:
        'A subset of mobile app users have been unable to log in since yesterday evening, seeing ' +
        '"Session could not be verified".',
      evidenceIds: [`${ID}-ev-01`],
    },
    {
      statement:
        '23 App Store/Play Store reviews in the last 18 hours mention login failures, mostly from ' +
        'users on iOS app version 4.8.0 and below.',
      evidenceIds: [`${ID}-ev-02`],
    },
    {
      statement:
        'auth-service logged 340 JWT signature verification failures between 19:00 and 08:00, all ' +
        'from client versions below 4.9.0.',
      evidenceIds: [`${ID}-ev-03`],
    },
    {
      statement:
        'auth-service deployed v3.12.0 at 18:45 UTC, rotating the JWT signing key with the old key ' +
        'retained for a 24h grace period.',
      evidenceIds: [`${ID}-ev-04`],
    },
    {
      statement:
        '401 Unauthorized responses for POST /auth/verify-session reached 12% of requests (baseline ' +
        '< 0.5%) between 19:00 and 08:00.',
      evidenceIds: [`${ID}-ev-05`],
    },
    {
      statement: 'Grace-period signing-key cache miss rate reached 34% during the rotation window (expected < 5%).',
      evidenceIds: [`${ID}-ev-06`],
    },
    {
      statement: 'Error rate by client version: v4.8.x and below = 14%, v4.9.0+ = 0.2% (snapshot 08:00 UTC).',
      evidenceIds: [`${ID}-ev-11`],
    },
  ],
  mustNotBePresentedAsFacts: [
    'The cache-eviction bug during key rotation is the cause.',
    "The old app version's stale token-refresh implementation alone explains it.",
    'The APNs certificate expiration is related to this incident.',
  ],
  plausibleHypotheses: [
    {
      id: 'cache-eviction',
      summary:
        'Signing-key cache eviction under memory pressure during the rotation window is causing ' +
        'verification failures independent of client version.',
      supportingEvidenceIds: [`${ID}-ev-06`, `${ID}-ev-07`],
      contradictingEvidenceIds: [`${ID}-ev-11`],
    },
    {
      id: 'stale-token-refresh',
      summary:
        "Older app versions' (< 4.9.0) stale token-refresh implementation is incompatible with the " +
        'new signing key, independent of any cache issue.',
      supportingEvidenceIds: [`${ID}-ev-03`, `${ID}-ev-11`, `${ID}-ev-10`],
      contradictingEvidenceIds: [`${ID}-ev-06`],
    },
    {
      id: 'combined-cache-and-version',
      summary:
        'Both factors compound: old clients are more likely to hit a cache miss during the grace ' +
        'period because of how they refresh tokens, so cache eviction disproportionately impacts them.',
      supportingEvidenceIds: [`${ID}-ev-03`, `${ID}-ev-06`, `${ID}-ev-11`],
      contradictingEvidenceIds: [],
    },
    {
      id: 'apns-decoy',
      summary: 'The expired APNs certificate is causing the login failures.',
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [`${ID}-ev-09`],
    },
  ],
  challengingEvidenceIdsForLeadingExplanation: [`${ID}-ev-11`, `${ID}-ev-12`],
  expectedReasoningRisks: ['anchoring-bias', 'confirmation-bias', 'base-rate-neglect', 'post-hoc-fallacy'],
  distractingEvidenceIds: [`${ID}-ev-09`],
  missingInformationEvidenceIds: [`${ID}-ev-13`],
  approximateOrInferredEvidenceIds: [`${ID}-ev-12`, `${ID}-ev-13`],
  openQuestions: [
    'Would the cache-eviction rate have been elevated even for users on the newest app version?',
    'Is the 24h grace period long enough given observed cache-miss behavior, or does it need to be extended?',
    'Were similar login-failure spikes during past key-rotation windows ever confirmed to share this cause?',
  ],
};
