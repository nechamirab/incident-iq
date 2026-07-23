import { databaseConnectionLeakEvaluation } from './databaseConnectionLeak.eval.js';
import { paymentGatewayTimeoutEvaluation } from './paymentGatewayTimeout.eval.js';
import { asyncQueueBacklogEvaluation } from './asyncQueueBacklog.eval.js';
import type { ScenarioEvaluationFixture } from './types.js';

/** Every scenario evaluation fixture, for the 3 new sample incidents added alongside the OpenAI provider. */
export const scenarioEvaluations: ScenarioEvaluationFixture[] = [
  databaseConnectionLeakEvaluation,
  paymentGatewayTimeoutEvaluation,
  asyncQueueBacklogEvaluation,
];

export { databaseConnectionLeakEvaluation, paymentGatewayTimeoutEvaluation, asyncQueueBacklogEvaluation };
export type { ScenarioEvaluationFixture, ScenarioHypothesisFixture } from './types.js';
