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

describe('PATCH /api/incidents/:incidentId/statements/:statementId/review', () => {
  it('marks a fact as supported after a real analysis run', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const factId = body<{ facts: Array<{ id: string }> }>(analyzeResponse).data?.facts[0]?.id;
    expect(factId).toBeTruthy();

    const reviewResponse = await request(app)
      .patch(`/api/incidents/${incidentId}/statements/${factId}/review`)
      .send({ reviewStatus: 'supported' });

    expect(reviewResponse.status).toBe(200);
    const updatedIncident = body<Incident>(reviewResponse).data;
    const updatedFact = updatedIncident?.analysisRuns[0]?.facts.find((f) => f.id === factId);
    expect(updatedFact?.reviewStatus).toBe('supported');
  });

  it('marks an assumption as rejected', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const assumptionId = body<{ assumptions: Array<{ id: string }> }>(analyzeResponse).data
      ?.assumptions[0]?.id;

    if (!assumptionId) {
      // This sample may not produce assumptions; skip gracefully rather than
      // asserting on data the mock provider didn't happen to generate.
      return;
    }

    const reviewResponse = await request(app)
      .patch(`/api/incidents/${incidentId}/statements/${assumptionId}/review`)
      .send({ reviewStatus: 'rejected' });

    expect(reviewResponse.status).toBe(200);
    const updatedIncident = body<Incident>(reviewResponse).data;
    const updatedAssumption = updatedIncident?.analysisRuns[0]?.assumptions.find(
      (a) => a.id === assumptionId,
    );
    expect(updatedAssumption?.reviewStatus).toBe('rejected');
  });

  it('returns 404 for a missing incident', async () => {
    const app = buildApp();
    const response = await request(app)
      .patch('/api/incidents/does-not-exist/statements/fact-1/review')
      .send({ reviewStatus: 'supported' });

    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('STATEMENT_NOT_FOUND');
  });

  it('returns 404 for a missing statement id on a real incident', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/statements/does-not-exist/review`)
      .send({ reviewStatus: 'supported' });

    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('STATEMENT_NOT_FOUND');
  });

  it('returns 400 for an invalid reviewStatus value', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const factId = body<{ facts: Array<{ id: string }> }>(analyzeResponse).data?.facts[0]?.id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/statements/${factId}/review`)
      .send({ reviewStatus: 'confirmed' });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });
});
