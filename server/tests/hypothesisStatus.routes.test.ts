import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { MockAIProvider } from '../src/ai/providers/MockAIProvider.js';
import type { ApiResponse } from '../../shared/types/apiResponse.js';
import type { Incident } from '../../shared/types/incident.js';

function buildApp(): Express {
  return createApp({
    incidentRepository: new InMemoryIncidentRepository(sampleIncidents),
    aiProvider: new MockAIProvider(),
  });
}

function body<T>(response: request.Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

describe('PATCH /api/incidents/:incidentId/hypotheses/:hypothesisId/status', () => {
  it('marks a hypothesis as testing after a real analysis run', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const hypothesisId = body<{ hypotheses: Array<{ id: string }> }>(analyzeResponse).data?.hypotheses[0]?.id;
    expect(hypothesisId).toBeTruthy();

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/hypotheses/${hypothesisId}/status`)
      .send({ status: 'testing' });

    expect(response.status).toBe(200);
    const updated = body<Incident>(response).data?.analysisRuns[0]?.hypotheses.find(
      (h) => h.id === hypothesisId,
    );
    expect(updated?.status).toBe('testing');
    expect(updated?.previousStatus).toBe('proposed');
  });

  it('confirms a hypothesis as human-verified when "confirmed": true is supplied, recording the note', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const hypothesisId = body<{ hypotheses: Array<{ id: string }> }>(analyzeResponse).data?.hypotheses[0]?.id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/hypotheses/${hypothesisId}/status`)
      .send({ status: 'confirmed-by-human', confirmed: true, humanReviewNote: 'Verified against runbook.' });

    expect(response.status).toBe(200);
    const updated = body<Incident>(response).data?.analysisRuns[0]?.hypotheses.find(
      (h) => h.id === hypothesisId,
    );
    expect(updated?.status).toBe('confirmed-by-human');
    expect(updated?.humanReviewNote).toBe('Verified against runbook.');
    expect(updated?.reviewedAt).toBeTruthy();
  });

  it('rejects setting status to confirmed-by-human without the explicit confirmed flag', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const hypothesisId = body<{ hypotheses: Array<{ id: string }> }>(analyzeResponse).data?.hypotheses[0]?.id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/hypotheses/${hypothesisId}/status`)
      .send({ status: 'confirmed-by-human' });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects setting status to confirmed-by-human when confirmed is explicitly false', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const hypothesisId = body<{ hypotheses: Array<{ id: string }> }>(analyzeResponse).data?.hypotheses[0]?.id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/hypotheses/${hypothesisId}/status`)
      .send({ status: 'confirmed-by-human', confirmed: false });

    expect(response.status).toBe(400);
  });

  it('never requires the confirmed flag for a non-confirming status change', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const hypothesisId = body<{ hypotheses: Array<{ id: string }> }>(analyzeResponse).data?.hypotheses[0]?.id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/hypotheses/${hypothesisId}/status`)
      .send({ status: 'weakened' });

    expect(response.status).toBe(200);
  });

  it('returns 404 for a missing incident', async () => {
    const app = buildApp();
    const response = await request(app)
      .patch('/api/incidents/does-not-exist/hypotheses/hyp-1/status')
      .send({ status: 'testing' });

    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('HYPOTHESIS_NOT_FOUND');
  });

  it('returns 404 for a missing hypothesis id on a real incident', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/hypotheses/does-not-exist/status`)
      .send({ status: 'testing' });

    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('HYPOTHESIS_NOT_FOUND');
  });

  it('returns 400 for an invalid status value', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const hypothesisId = body<{ hypotheses: Array<{ id: string }> }>(analyzeResponse).data?.hypotheses[0]?.id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/hypotheses/${hypothesisId}/status`)
      .send({ status: 'definitely-true' });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('never lets the AI-facing pipeline set confirmed-by-human -- only this endpoint can', async () => {
    // Regression guard: a fresh analysis run must never come back
    // pre-confirmed, no matter what the (mock) provider returns.
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const hypotheses = body<{ hypotheses: Array<{ status: string }> }>(analyzeResponse).data?.hypotheses ?? [];
    expect(hypotheses.every((h) => h.status === 'proposed')).toBe(true);
  });
});
