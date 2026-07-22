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

describe('POST /api/incidents/:incidentId/postmortem', () => {
  it('drafts a postmortem from the most recent analysis run', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);

    const response = await request(app).post(`/api/incidents/${incidentId}/postmortem`);

    expect(response.status).toBe(201);
    const incident = body<Incident>(response).data;
    expect(incident?.postmortem).not.toBeNull();
    expect(incident?.postmortem?.promptVersion).toBe('postmortem-v1');
    expect(incident?.postmortem?.lastEditedAt).toBeNull();
  });

  it('persists the draft so it is present on a subsequent GET', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);
    await request(app).post(`/api/incidents/${incidentId}/postmortem`);

    const getResponse = await request(app).get(`/api/incidents/${incidentId}`);
    expect(body<Incident>(getResponse).data?.postmortem).not.toBeNull();
  });

  it('returns 400 when the incident has no analysis run yet', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/postmortem`);
    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('NO_ANALYSIS_FOR_POSTMORTEM');
  });

  it('returns 404 for a missing incident', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/incidents/does-not-exist/postmortem');
    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('INCIDENT_NOT_FOUND');
  });
});

describe('PATCH /api/incidents/:incidentId/postmortem', () => {
  it('edits a postmortem field', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);
    await request(app).post(`/api/incidents/${incidentId}/postmortem`);

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/postmortem`)
      .send({ incidentSummary: 'A human-edited summary.' });

    expect(response.status).toBe(200);
    const incident = body<Incident>(response).data;
    expect(incident?.postmortem?.incidentSummary).toBe('A human-edited summary.');
    expect(incident?.postmortem?.lastEditedAt).not.toBeNull();
  });

  it('rejects attempting to set a system-managed provenance field', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);
    await request(app).post(`/api/incidents/${incidentId}/postmortem`);

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/postmortem`)
      .send({ provider: 'anthropic' });

    // The unknown-to-the-edit-schema field is stripped by Zod's default
    // "strip" mode rather than rejected -- confirms it has no effect.
    expect(response.status).toBe(200);
    const incident = body<Incident>(response).data;
    expect(incident?.postmortem?.provider).toBe('mock');
  });

  it('returns 400 when no postmortem draft exists yet', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/postmortem`)
      .send({ incidentSummary: 'x' });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('NO_POSTMORTEM_DRAFT');
  });

  it('returns 404 for a missing incident', async () => {
    const app = buildApp();
    const response = await request(app)
      .patch('/api/incidents/does-not-exist/postmortem')
      .send({ incidentSummary: 'x' });

    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('INCIDENT_NOT_FOUND');
  });

  it('returns 400 for an invalid field type', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);
    await request(app).post(`/api/incidents/${incidentId}/postmortem`);

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/postmortem`)
      .send({ contributingFactors: 'not an array' });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });
});
