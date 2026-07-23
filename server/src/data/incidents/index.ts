import type { Incident } from '../../../../shared/types/incident.js';
import { ecommerceCheckoutIncident } from './ecommerceCheckout.js';
import { courseRegistrationSlowdownIncident } from './courseRegistrationSlowdown.js';
import { mobileLoginFailureIncident } from './mobileLoginFailure.js';
import { databaseConnectionLeakIncident } from './databaseConnectionLeak.js';
import { paymentGatewayTimeoutIncident } from './paymentGatewayTimeout.js';
import { asyncQueueBacklogIncident } from './asyncQueueBacklog.js';

/**
 * The six bundled synthetic incidents used for local development, demos,
 * and the deterministic mock AI provider (Stage 4). Each ships with
 * realistic, deliberately ambiguous evidence so no single item gives away
 * the root cause. New incidents are appended, never inserted earlier in
 * this array or reordered -- several tests index into it positionally
 * (e.g. `sampleIncidents[0]`).
 */
export const sampleIncidents: Incident[] = [
  ecommerceCheckoutIncident,
  courseRegistrationSlowdownIncident,
  mobileLoginFailureIncident,
  databaseConnectionLeakIncident,
  paymentGatewayTimeoutIncident,
  asyncQueueBacklogIncident,
];

export {
  ecommerceCheckoutIncident,
  courseRegistrationSlowdownIncident,
  mobileLoginFailureIncident,
  databaseConnectionLeakIncident,
  paymentGatewayTimeoutIncident,
  asyncQueueBacklogIncident,
};

/**
 * The fixed ids of the bundled sample incidents -- the single source of
 * truth for "is this incident one of the built-in presets", used by
 * `GET /api/incidents/samples`. Deliberately *not* inferred from
 * `scenarioType`: a user-created incident can end up with a non-`custom`
 * scenarioType too (e.g. after "Load sample incident" prefills the New
 * Incident form and the user submits it), so that field cannot reliably
 * distinguish a true bundled sample from a user's own incident.
 */
export const SAMPLE_INCIDENT_IDS: readonly string[] = sampleIncidents.map((incident) => incident.id);
