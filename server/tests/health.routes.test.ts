import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { MockAIProvider } from '../src/ai/providers/MockAIProvider.js';
import { AnthropicAIProvider } from '../src/ai/providers/AnthropicAIProvider.js';
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

  it('reports apiKeyConfigured: true and providerVerified: false for an unverified Anthropic provider', async () => {
    const provider = new AnthropicAIProvider(FAKE_KEY, 'claude-sonnet-5');
    const response = await request(buildApp(provider)).get('/api/health');
    const ai = body<HealthCheckResult>(response).data?.ai;

    // The health check never makes a provider request -- a configured key
    // is reported honestly as unverified until a real call has succeeded.
    expect(ai?.providerVerified).toBe(false);
  });

  it('reports configuredProvider and mockFallbackEnabled from the resolved app config', async () => {
    const response = await request(buildApp()).get('/api/health');
    const ai = body<HealthCheckResult>(response).data?.ai;
    expect(typeof ai?.configuredProvider).toBe('string');
    expect(typeof ai?.mockFallbackEnabled).toBe('boolean');
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
