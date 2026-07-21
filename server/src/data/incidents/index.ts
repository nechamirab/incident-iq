import type { Incident } from '../../../../shared/types/incident.js';
import { ecommerceCheckoutIncident } from './ecommerceCheckout.js';
import { courseRegistrationSlowdownIncident } from './courseRegistrationSlowdown.js';
import { mobileLoginFailureIncident } from './mobileLoginFailure.js';

/**
 * The three bundled synthetic incidents used for local development, demos,
 * and the deterministic mock AI provider (Stage 4). Each ships with
 * realistic, deliberately ambiguous evidence so no single item gives away
 * the root cause.
 */
export const sampleIncidents: Incident[] = [
  ecommerceCheckoutIncident,
  courseRegistrationSlowdownIncident,
  mobileLoginFailureIncident,
];

export { ecommerceCheckoutIncident, courseRegistrationSlowdownIncident, mobileLoginFailureIncident };
