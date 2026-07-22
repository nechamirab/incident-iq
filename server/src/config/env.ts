import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import type { AiProviderName } from '../../../shared/types/analysisRun.js';

// The server workspace is always run with its own directory as the working
// directory (`npm run dev --workspace=server`, or `cd server && npm start`),
// so the single project-wide `.env` file lives one level up from there.
loadDotenv({ path: '../.env', quiet: true });

/**
 * Backend runtime configuration, resolved once at startup from environment
 * variables. Centralizing this avoids `process.env` lookups scattered
 * across the codebase -- `buildAppConfig`/`EnvSchema` below are the only
 * place any environment variable is read.
 */
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  corsOrigin: string;
  aiProvider: AiProviderName;
  /** `undefined` when unset *or* set to an empty/whitespace-only string -- both mean "no key configured". */
  anthropicApiKey: string | undefined;
  anthropicModel: string;
  /**
   * Whether `createAIProvider` may fall back to `MockAIProvider` when
   * `AI_PROVIDER=anthropic` but no API key is configured. Defaults to
   * `false` -- a misconfigured Anthropic setup must fail loudly, never
   * silently present mock output as real AI output.
   */
  allowMockFallback: boolean;
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

/**
 * Validates the shape of every environment variable this backend reads.
 * Every field is an optional string (environment variables are always
 * strings-or-absent) -- the *meaning* of "missing" differs per field and is
 * resolved in {@link buildAppConfig}, not here:
 *
 * - `AI_PROVIDER`, if set, must be exactly `"mock"` or `"anthropic"` --
 *   anything else (a typo, an unsupported provider name) is a hard
 *   configuration error, since silently coercing an unrecognized value to
 *   `"mock"` would be exactly the kind of silent AI-mode substitution this
 *   configuration is meant to prevent.
 * - `ALLOW_MOCK_FALLBACK`, if set, must be exactly `"true"` or `"false"` --
 *   any other value (`"yes"`, `"1"`, ...) is rejected rather than guessed at.
 * - `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` accept any string, including
 *   empty -- an empty key is treated the same as an absent one downstream,
 *   never as a schema-validation failure (a blank `.env` line is normal).
 */
const EnvSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  AI_PROVIDER: z.enum(['mock', 'anthropic'], {
    message: 'AI_PROVIDER must be "mock" or "anthropic" (unsupported AI provider).',
  }).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  ALLOW_MOCK_FALLBACK: z
    .enum(['true', 'false'], {
      message: 'ALLOW_MOCK_FALLBACK must be exactly "true" or "false" (invalid boolean configuration).',
    })
    .optional(),
});

function resolveNodeEnv(value: string | undefined): AppConfig['nodeEnv'] {
  if (value === 'production' || value === 'test') {
    return value;
  }
  return 'development';
}

/**
 * Parses and validates `env` into a fully-resolved {@link AppConfig},
 * applying every default. Pure (aside from reading its `env` argument), so
 * it can be exercised directly in tests with a synthetic environment object
 * instead of mutating real `process.env` or reloading modules.
 *
 * @param env The raw environment to read from (normally `process.env`).
 * @throws {Error} if `AI_PROVIDER` or `ALLOW_MOCK_FALLBACK` is set to an
 * unsupported/malformed value. A missing or empty `ANTHROPIC_API_KEY` is
 * never an error here -- see {@link AppConfig.anthropicApiKey}'s doc comment.
 */
export function buildAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }

  const raw = parsed.data;
  const anthropicApiKey = raw.ANTHROPIC_API_KEY?.trim();

  return {
    port: Number(raw.PORT ?? 4001),
    nodeEnv: resolveNodeEnv(raw.NODE_ENV),
    corsOrigin: raw.CORS_ORIGIN ?? 'http://localhost:5173',
    aiProvider: raw.AI_PROVIDER ?? 'mock',
    anthropicApiKey: anthropicApiKey && anthropicApiKey.length > 0 ? anthropicApiKey : undefined,
    anthropicModel: raw.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
    allowMockFallback: raw.ALLOW_MOCK_FALLBACK === 'true',
  };
}

export const config: AppConfig = buildAppConfig(process.env);
