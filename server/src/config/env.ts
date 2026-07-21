import { config as loadDotenv } from 'dotenv';

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
}

function resolveNodeEnv(value: string | undefined): AppConfig['nodeEnv'] {
  if (value === 'production' || value === 'test') {
    return value;
  }
  return 'development';
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4001),
  nodeEnv: resolveNodeEnv(process.env.NODE_ENV),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
