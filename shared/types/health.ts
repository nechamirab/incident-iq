/**
 * Safe (never secret-carrying) AI provider diagnostics, included in the
 * health check response. `apiKeyConfigured` only reflects whether a key is
 * *present* in configuration -- it is not proof the key is valid.
 * `providerVerified` is the stronger claim: `true` only after a real
 * request to the configured provider has actually succeeded during this
 * process's lifetime; `null` when verification doesn't apply (mock mode).
 * The health check itself never makes a provider request merely to answer
 * this question.
 */
export interface AiProviderDiagnostics {
  configuredProvider: 'mock' | 'anthropic';
  apiKeyConfigured: boolean;
  mockFallbackEnabled: boolean;
  providerVerified: boolean | null;
}

/**
 * Payload returned by `GET /api/health`, used by the frontend to confirm
 * connectivity with the backend and to display basic runtime information.
 */
export interface HealthCheckResult {
  status: 'ok';
  service: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  ai: AiProviderDiagnostics;
}
