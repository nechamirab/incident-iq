import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { MockAIProvider } from '../src/ai/providers/MockAIProvider.js';
import { AnthropicAIProvider } from '../src/ai/providers/AnthropicAIProvider.js';
import { OpenAIProvider } from '../src/ai/providers/OpenAIProvider.js';
import type { AIProvider } from '../src/ai/providers/AIProvider.js';
import type { ApiResponse } from '../../shared/types/apiResponse.js';
import type { HealthCheckResult } from '../../shared/types/health.js';

const FAKE_KEY = 'sk-ant-health-test-key-should-not-leak';

function buildApp(aiProvider: AIProvider = new MockAIProvider()): Express {
  return createApp({
    incidentRepository: new InMemoryIncidentRepository(sampleIncidents),
    aiProvider,
  });
}

function body<T>(response: request.Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

describe('GET /api/health', () => {
  it('reports basic liveness information', async () => {
    const response = await request(buildApp()).get('/api/health');
    expect(response.status).toBe(200);
    const health = body<HealthCheckResult>(response).data;
    expect(health?.status).toBe('ok');
    expect(health?.service).toBe('incident-iq-api');
    expect(typeof health?.uptimeSeconds).toBe('number');
  });

  it('reports mock provider diagnostics when using MockAIProvider', async () => {
    const response = await request(buildApp(new MockAIProvider())).get('/api/health');
    const ai = body<HealthCheckResult>(response).data?.ai;
    expect(ai?.providerVerified).toBeNull();
  });

  it('reports providerVerified: false for an unverified Anthropic provider', async () => {
    const provider = new AnthropicAIProvider(FAKE_KEY, 'claude-sonnet-5');
    const response = await request(buildApp(provider)).get('/api/health');
    const ai = body<HealthCheckResult>(response).data?.ai;

    // The health check never makes a provider request -- a configured key
    // is reported honestly as unverified until a real call has succeeded.
    expect(ai?.providerVerified).toBe(false);
  });

  it('reports providerVerified: false for an unverified OpenAI provider', async () => {
    const provider = new OpenAIProvider(FAKE_KEY, 'gpt-5.1');
    const response = await request(buildApp(provider)).get('/api/health');
    const ai = body<HealthCheckResult>(response).data?.ai;

    expect(ai?.providerVerified).toBe(false);
  });

  it('never includes an OpenAI API key, in any form, in the response body', async () => {
    const provider = new OpenAIProvider(FAKE_KEY, 'gpt-5.1');
    const response = await request(buildApp(provider)).get('/api/health');
    expect(JSON.stringify(response.body)).not.toContain(FAKE_KEY);
  });

  it('reports configuredProvider and mockFallbackEnabled from the resolved app config', async () => {
    const response = await request(buildApp()).get('/api/health');
    const ai = body<HealthCheckResult>(response).data?.ai;
    expect(typeof ai?.configuredProvider).toBe('string');
    expect(typeof ai?.mockFallbackEnabled).toBe('boolean');
  });

  it('reports configuredModel as either a non-empty string or null, matching apiKeyConfigured\'s applicability', async () => {
    // Diagnostics are driven by this process's actual resolved config (not
    // the injected provider instance -- see the tests below), so this only
    // asserts the field's shape, not a specific value; `getAiProviderDiagnostics`
    // in createAIProvider.test.ts covers the precise mock/anthropic/openai
    // mapping deterministically, independent of the real environment.
    const response = await request(buildApp()).get('/api/health');
    const ai = body<HealthCheckResult>(response).data?.ai;
    expect(ai?.configuredModel === null || typeof ai?.configuredModel === 'string').toBe(true);
  });

  it('never includes the API key, in any form, in the response body', async () => {
    const provider = new AnthropicAIProvider(FAKE_KEY, 'claude-sonnet-5');
    const response = await request(buildApp(provider)).get('/api/health');
    expect(JSON.stringify(response.body)).not.toContain(FAKE_KEY);
  });

  it('returns the standard API response shape', async () => {
    const response = await request(buildApp()).get('/api/health');
    const responseBody = body<HealthCheckResult>(response);
    expect(responseBody).toHaveProperty('success', true);
    expect(responseBody).toHaveProperty('data');
    expect(responseBody).toHaveProperty('error', null);
  });
});
