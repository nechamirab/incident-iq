import { config as loadDotenv } from 'dotenv';
import type { AiProviderName } from '../../../shared/types/analysisRun.js';

// The server workspace is always run with its own directory as the working
// directory (`npm run dev --workspace=server`, or `cd server && npm start`),
// so the single project-wide `.env` file lives one level up from there.
loadDotenv({ path: '../.env', quiet: true });

/**
 * Backend runtime configuration, resolved once at startup from environment
 * variables. Centralizing this avoids `process.env` lookups scattered
 * across the codebase.
 */
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  corsOrigin: string;
  aiProvider: AiProviderName;
  anthropicApiKey: string | undefined;
  anthropicModel: string;
}

function resolveNodeEnv(value: string | undefined): AppConfig['nodeEnv'] {
  if (value === 'production' || value === 'test') {
    return value;
  }
  return 'development';
}

function resolveAiProvider(value: string | undefined): AiProviderName {
  return value === 'anthropic' ? 'anthropic' : 'mock';
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4001),
  nodeEnv: resolveNodeEnv(process.env.NODE_ENV),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  aiProvider: resolveAiProvider(process.env.AI_PROVIDER),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
};
