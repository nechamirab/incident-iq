import { databaseConnectionLeakEvaluation } from './databaseConnectionLeak.eval.js';
import { paymentGatewayTimeoutEvaluation } from './paymentGatewayTimeout.eval.js';
import { asyncQueueBacklogEvaluation } from './asyncQueueBacklog.eval.js';
import { ecommerceCheckoutEvaluation } from './ecommerceCheckout.eval.js';
import { courseRegistrationSlowdownEvaluation } from './courseRegistrationSlowdown.eval.js';
import { mobileLoginFailureEvaluation } from './mobileLoginFailure.eval.js';
import type { ScenarioEvaluationFixture } from './types.js';

/** Every scenario evaluation fixture, covering all six bundled sample incidents. */
export const scenarioEvaluations: ScenarioEvaluationFixture[] = [
  databaseConnectionLeakEvaluation,
  paymentGatewayTimeoutEvaluation,
  asyncQueueBacklogEvaluation,
  ecommerceCheckoutEvaluation,
  courseRegistrationSlowdownEvaluation,
  mobileLoginFailureEvaluation,
];

export {
  databaseConnectionLeakEvaluation,
  paymentGatewayTimeoutEvaluation,
  asyncQueueBacklogEvaluation,
  ecommerceCheckoutEvaluation,
  courseRegistrationSlowdownEvaluation,
  mobileLoginFailureEvaluation,
};
export type { ScenarioEvaluationFixture, ScenarioHypothesisFixture } from './types.js';
