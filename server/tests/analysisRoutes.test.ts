import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { AnthropicAIProvider } from '../src/ai/providers/AnthropicAIProvider.js';
import { MockAIProvider } from '../src/ai/providers/MockAIProvider.js';
import { FakeAIProvider } from './helpers/FakeAIProvider.js';
import type { AIProvider } from '../src/ai/providers/AIProvider.js';
import type { ApiResponse } from '../../shared/types/apiResponse.js';
import type { AnalysisRun } from '../../shared/types/analysisRun.js';

function buildApp(aiProvider: AIProvider): Express {
  return createApp({
    incidentRepository: new InMemoryIncidentRepository(sampleIncidents),
    aiProvider,
  });
}

function body<T>(response: request.Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

describe('POST /api/incidents/:incidentId/analyze', () => {
  it('runs a full analysis with the real mock provider and returns a valid run', async () => {
    const app = buildApp(new MockAIProvider());
    const response = await request(app).post(`/api/incidents/${sampleIncidents[0].id}/analyze`);

    expect(response.status).toBe(201);
    const run = body<AnalysisRun>(response).data;
    expect(run?.provider).toBe('mock');
    expect(run?.status).toBe('completed');
    expect(run?.hypotheses.length).toBeGreaterThanOrEqual(3);
  });

  it('persists the run so it is visible on a subsequent GET of the incident', async () => {
    const app = buildApp(new MockAIProvider());
    const incidentId = sampleIncidents[1].id;

    await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const getResponse = await request(app).get(`/api/incidents/${incidentId}`);

    expect(body<{ analysisRuns: AnalysisRun[]; status: string }>(getResponse).data?.analysisRuns).toHaveLength(
      1,
    );
    expect(body<{ status: string }>(getResponse).data?.status).toBe('under-investigation');
  });

  it('returns 404 for a missing incident', async () => {
    const app = buildApp(new MockAIProvider());
    const response = await request(app).post('/api/incidents/does-not-exist/analyze');
    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('INCIDENT_NOT_FOUND');
  });

  it('returns a controlled 502 when the AI response is invalid after a retry', async () => {
    const app = buildApp(new FakeAIProvider(['nope', 'still nope']));
    const response = await request(app).post(`/api/incidents/${sampleIncidents[0].id}/analyze`);

    expect(response.status).toBe(502);
    expect(body<null>(response).error?.code).toBe('AI_RESPONSE_INVALID');
  });

  it('returns a clear, controlled error when AI_PROVIDER=anthropic but no API key is configured', async () => {
    const app = buildApp(new AnthropicAIProvider(undefined, 'claude-sonnet-5'));
    const response = await request(app).post(`/api/incidents/${sampleIncidents[0].id}/analyze`);

    expect(response.status).toBe(503);
    expect(body<null>(response).error?.code).toBe('AI_PROVIDER_NOT_CONFIGURED');
    expect(body<null>(response).error?.message).toMatch(/AI_PROVIDER=mock/);
  });

  it('produces a non-empty timeline for an incident created from "Load sample incident"-style reconstructed text', async () => {
    // Mirrors buildFormValuesFromIncident: each evidence line reconstructed
    // as "[<timestamp>] <content>", then resubmitted as plain text -- the
    // exact "Load sample incident" -> "Save & analyze incident" path.
    const app = buildApp(new MockAIProvider());
    const sample = sampleIncidents[0];
    const deploymentNoteLines = sample.evidence
      .filter((item) => item.sourceType === 'deployment-note')
      .map((item) => `[${item.timestamp}] ${item.originalContent}`)
      .join('\n');
    const applicationLogLines = sample.evidence
      .filter((item) => item.sourceType === 'application-log')
      .map((item) => `[${item.timestamp}] ${item.originalContent}`)
      .join('\n');

    const createResponse = await request(app)
      .post('/api/incidents')
      .field('title', sample.title)
      .field('description', sample.description)
      .field('severity', sample.severity)
      .field('affectedService', sample.affectedService)
      .field('detectedAt', sample.detectedAt)
      .field('deploymentNotes', deploymentNoteLines)
      .field('applicationLogs', applicationLogLines);

    expect(createResponse.status).toBe(201);
    const newIncidentId = body<{ id: string; evidence: { timestamp: string | null }[] }>(
      createResponse,
    ).data?.id;

    const reconstructedEvidence = body<{ evidence: { timestamp: string | null }[] }>(createResponse)
      .data?.evidence;
    expect(reconstructedEvidence?.some((item) => item.timestamp !== null)).toBe(true);

    const analyzeResponse = await request(app).post(`/api/incidents/${newIncidentId}/analyze`);
    expect(analyzeResponse.status).toBe(201);
    const run = body<AnalysisRun>(analyzeResponse).data;
    expect(run?.timeline.length).toBeGreaterThan(0);
  });
});
