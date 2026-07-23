#!/usr/bin/env node
/**
 * Entry point for `npm run ai:experiment` -- the critical-AI experiment
 * framework (Stage 7 / `docs/experiments/`). Never imported by any test or
 * production code path; only ever invoked directly via `tsx` from the
 * `ai:experiment` npm script, so it can never run automatically as part of
 * `npm test`.
 *
 * Usage:
 *   npm run ai:experiment -- --experiment=all
 *   npm run ai:experiment -- --experiment=A,C --real --provider=openai --yes
 *
 * Flags:
 *   --experiment=A,B,C,D|all   Which experiment(s) to run (default: all).
 *   --incident=<id>            Sample incident id to use (default: sample-db-connection-leak).
 *   --real                     Attempt real-provider calls, subject to every safety gate below.
 *   --provider=openai,anthropic  Which real provider(s) to attempt (required with --real).
 *   --yes                      Explicit approval for real-provider calls (skips the interactive prompt).
 *
 * Real-provider calls additionally require RUN_REAL_AI_EXPERIMENTS=true in
 * the environment and a configured API key for the requested provider --
 * see `realCallGate.ts`. Without all of these, every experiment still runs
 * in mock-only mode: real-provider legs are honestly recorded as NOT RUN,
 * never invented or silently skipped.
 */
import { createInterface } from 'node:readline/promises';
import { config as appConfig, type AppConfig } from '../config/env.js';
import { sampleIncidents } from '../data/incidents/index.js';
import { createAIProvider, type CreateAIProviderConfig } from '../ai/providers/createAIProvider.js';
import { MockAIProvider } from '../ai/providers/MockAIProvider.js';
import type { AIProvider } from '../ai/providers/AIProvider.js';
import type { AiProviderName } from '../../../shared/types/analysisRun.js';
import { evaluateRealCallGate, type RealCallGateResult } from './realCallGate.js';
import { runPromptComparisonExperiment } from './promptComparisonExperiment.js';
import { runProviderComparisonExperiment, type RealProviderAttempt } from './providerComparisonExperiment.js';
import { runPromptSensitivityExperiment } from './promptSensitivityExperiment.js';
import { runSkepticReviewEvaluationExperiment } from './skepticReviewEvaluationExperiment.js';
import {
  formatPromptComparisonMarkdown,
  formatProviderComparisonMarkdown,
  formatPromptSensitivityMarkdown,
  formatSkepticReviewMarkdown,
} from './formatExperimentReports.js';
import { saveExperimentResult } from './saveExperimentResults.js';

const DEFAULT_INCIDENT_ID = 'sample-db-connection-leak';
const REAL_PROVIDERS: readonly AiProviderName[] = ['anthropic', 'openai'];

interface CliOptions {
  experiments: Set<'A' | 'B' | 'C' | 'D'>;
  incidentId: string;
  real: boolean;
  requestedProviders: AiProviderName[];
  approved: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, value] = arg.slice(2).split('=');
    flags.set(key, value ?? 'true');
  }

  const experimentFlag = flags.get('experiment') ?? 'all';
  const experiments =
    experimentFlag === 'all'
      ? new Set<'A' | 'B' | 'C' | 'D'>(['A', 'B', 'C', 'D'])
      : new Set(
          experimentFlag
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter((s): s is 'A' | 'B' | 'C' | 'D' => ['A', 'B', 'C', 'D'].includes(s)),
        );

  const requestedProviders = (flags.get('provider') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is AiProviderName => s === 'openai' || s === 'anthropic');

  return {
    experiments,
    incidentId: flags.get('incident') ?? DEFAULT_INCIDENT_ID,
    real: flags.has('real'),
    requestedProviders,
    approved: flags.has('yes'),
  };
}

/** Interactive y/N confirmation, used only when `--yes` was not already passed and stdin is a TTY -- otherwise real calls are simply refused rather than silently proceeding or hanging. */
async function confirmInteractively(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

function apiKeyConfiguredFor(provider: AiProviderName, cfg: AppConfig): boolean {
  if (provider === 'anthropic') return Boolean(cfg.anthropicApiKey);
  if (provider === 'openai') return Boolean(cfg.openaiApiKey);
  return false;
}

function buildRealProvider(provider: AiProviderName, cfg: AppConfig): AIProvider {
  const override: CreateAIProviderConfig = { ...cfg, aiProvider: provider, allowMockFallback: false };
  return createAIProvider(override);
}

async function resolveRealProviderAttempts(options: CliOptions, cfg: AppConfig): Promise<RealProviderAttempt[]> {
  if (!options.real) {
    return [];
  }
  if (options.requestedProviders.length === 0) {
    console.error('--real was passed but no --provider=openai|anthropic was specified. Nothing real will run.');
    return [];
  }

  let approved = options.approved;
  if (!approved) {
    approved = await confirmInteractively(
      `This will make ${options.requestedProviders.length} real, billable provider call(s) to: ` +
        `${options.requestedProviders.join(', ')}. Proceed?`,
    );
  }

  const attempts: RealProviderAttempt[] = [];
  for (const providerName of options.requestedProviders) {
    const gate: RealCallGateResult = evaluateRealCallGate({
      requested: true,
      runRealAiExperimentsEnabled: process.env.RUN_REAL_AI_EXPERIMENTS === 'true',
      apiKeyConfigured: apiKeyConfiguredFor(providerName, cfg),
      approved,
    });
    attempts.push({ provider: buildRealProvider(providerName, cfg), gate });
  }
  return attempts;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const incident = sampleIncidents.find((item) => item.id === options.incidentId);
  if (!incident) {
    console.error(`No bundled sample incident found with id "${options.incidentId}".`);
    process.exitCode = 1;
    return;
  }

  console.log(`IncidentIQ critical-AI experiment framework -- incident: ${incident.id}`);
  console.log(`Experiments to run: ${[...options.experiments].join(', ') || '(none)'}`);
  if (options.real) {
    console.log(`Real-provider calls requested for: ${options.requestedProviders.join(', ') || '(none specified)'}`);
  } else {
    console.log('Running in mock-only mode (pass --real --provider=openai|anthropic to attempt real calls).');
  }

  const mockProvider = new MockAIProvider();
  const realAttempts = await resolveRealProviderAttempts(options, appConfig);
  for (const attempt of realAttempts) {
    if (!attempt.gate.allowed) {
      console.log(`  [${attempt.provider.name}] NOT RUN -- ${attempt.gate.reason}`);
    } else {
      console.log(`  [${attempt.provider.name}] approved -- will make a real call.`);
    }
  }

  if (options.experiments.has('A')) {
    const result = await runPromptComparisonExperiment({
      incident,
      mockProvider,
      realProviderAttempt: realAttempts.find((a) => REAL_PROVIDERS.includes(a.provider.name)),
    });
    const { jsonPath, markdownPath } = saveExperimentResult(
      'prompt-comparison',
      result,
      formatPromptComparisonMarkdown(result),
    );
    console.log(`Experiment A saved: ${jsonPath}, ${markdownPath}`);
  }

  if (options.experiments.has('B')) {
    const result = await runProviderComparisonExperiment({
      incident,
      mockProvider,
      realProviderAttempts: realAttempts,
    });
    const { jsonPath, markdownPath } = saveExperimentResult(
      'provider-comparison',
      result,
      formatProviderComparisonMarkdown(result),
    );
    console.log(`Experiment B saved: ${jsonPath}, ${markdownPath}`);
  }

  if (options.experiments.has('C')) {
    const result = await runPromptSensitivityExperiment({
      incident,
      mockProvider,
      realProviderAttempt: realAttempts.find((a) => REAL_PROVIDERS.includes(a.provider.name)),
    });
    const { jsonPath, markdownPath } = saveExperimentResult(
      'prompt-sensitivity',
      result,
      formatPromptSensitivityMarkdown(result),
    );
    console.log(`Experiment C saved: ${jsonPath}, ${markdownPath}`);
  }

  if (options.experiments.has('D')) {
    const reviewAttempt = realAttempts[0];
    const result = await runSkepticReviewEvaluationExperiment({
      incident,
      mockProvider,
      reviewProvider: reviewAttempt?.gate.allowed ? reviewAttempt.provider : mockProvider,
      reviewGate: reviewAttempt?.gate ?? { allowed: true },
    });
    const { jsonPath, markdownPath } = saveExperimentResult('skeptic-review', result, formatSkepticReviewMarkdown(result));
    console.log(`Experiment D saved: ${jsonPath}, ${markdownPath}`);
  }

  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error('The critical-AI experiment run failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
