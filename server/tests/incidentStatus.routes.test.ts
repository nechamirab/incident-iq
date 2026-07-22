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

describe('PATCH /api/incidents/:incidentId/status', () => {
  it('accepts a valid non-resolution status transition', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'under-investigation' });

    expect(response.status).toBe(200);
    const incident = body<Incident>(response).data;
    expect(incident?.status).toBe('under-investigation');
    expect(incident?.resolvedAt).toBeNull();
  });

  it('rejects an unsupported status value', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'closed' });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects "analyzing" -- a system-managed status a user may never set directly', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'analyzing' });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects resolving without a resolvedAt', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'resolved' });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('correctly persists resolvedAt and resolutionNotes when resolving', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({
        status: 'resolved',
        resolvedAt: '2026-07-01T12:00:00Z',
        resolutionNotes: 'Reverted the connection pool change.',
      });

    expect(response.status).toBe(200);
    const incident = body<Incident>(response).data;
    expect(incident?.status).toBe('resolved');
    expect(incident?.resolvedAt).toBe('2026-07-01T12:00:00Z');
    expect(incident?.resolutionNotes).toBe('Reverted the connection pool change.');
  });

  it('clears resolvedAt when reopening a resolved incident', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'resolved', resolvedAt: '2026-07-01T12:00:00Z' });

    const reopenResponse = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'draft' });

    expect(reopenResponse.status).toBe(200);
    expect(body<Incident>(reopenResponse).data?.resolvedAt).toBeNull();
  });

  it('preserves resolvedAt when archiving a previously resolved incident', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'resolved', resolvedAt: '2026-07-01T12:00:00Z' });

    const archiveResponse = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'archived' });

    expect(archiveResponse.status).toBe(200);
    const incident = body<Incident>(archiveResponse).data;
    expect(incident?.status).toBe('archived');
    expect(incident?.resolvedAt).toBe('2026-07-01T12:00:00Z');
  });

  it('does not invent a resolvedAt when archiving an incident that was never resolved', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'archived' });

    expect(response.status).toBe(200);
    expect(body<Incident>(response).data?.resolvedAt).toBeNull();
  });

  it('returns the standard API response shape', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .send({ status: 'archived' });

    const responseBody = body<Incident>(response);
    expect(responseBody).toHaveProperty('success', true);
    expect(responseBody).toHaveProperty('data');
    expect(responseBody).toHaveProperty('error', null);
  });

  it('returns 404 for a missing incident', async () => {
    const app = buildApp();

    const response = await request(app)
      .patch('/api/incidents/does-not-exist/status')
      .send({ status: 'archived' });

    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('INCIDENT_NOT_FOUND');
  });
});
