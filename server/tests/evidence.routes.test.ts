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

describe('POST /api/incidents/:incidentId/evidence', () => {
  it('adds a valid evidence item to an existing incident', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    const evidenceCountBefore = sampleIncidents[0].evidence.length;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'application-log',
      sourceName: 'checkout-api.log',
      content: 'Connection pool exhausted at 14:32 UTC',
    });

    expect(response.status).toBe(201);
    const incident = body<Incident>(response).data;
    expect(incident?.evidence).toHaveLength(evidenceCountBefore + 1);
    const added = incident?.evidence[incident.evidence.length - 1];
    expect(added?.sourceType).toBe('application-log');
    expect(added?.sourceName).toBe('checkout-api.log');
    expect(added?.originalContent).toBe('Connection pool exhausted at 14:32 UTC');
  });

  it('uses the requested evidence source type exactly, unchanged', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'monitoring-alert',
      sourceName: 'Datadog',
      content: 'Error rate exceeded threshold',
    });

    const incident = body<Incident>(response).data;
    const added = incident?.evidence[incident.evidence.length - 1];
    expect(added?.sourceType).toBe('monitoring-alert');
  });

  it('accepts an optional timestamp', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'support-message',
      sourceName: 'Support ticket #4821',
      content: 'Customer reports checkout is broken.',
      timestamp: '2026-07-01T12:00:00Z',
    });

    const incident = body<Incident>(response).data;
    const added = incident?.evidence[incident.evidence.length - 1];
    expect(added?.timestamp).toBe('2026-07-01T12:00:00Z');
  });

  it('defaults timestamp to null when not supplied', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'application-log',
      sourceName: 'checkout-api.log',
      content: 'A log line with no timestamp.',
    });

    const incident = body<Incident>(response).data;
    const added = incident?.evidence[incident.evidence.length - 1];
    expect(added?.timestamp).toBeNull();
  });

  it('generates a unique evidence id rather than accepting one from the client', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app)
      .post(`/api/incidents/${incidentId}/evidence`)
      .send({
        sourceType: 'application-log',
        sourceName: 'checkout-api.log',
        content: 'A log line.',
        id: 'client-supplied-id',
      });

    const incident = body<Incident>(response).data;
    const added = incident?.evidence[incident.evidence.length - 1];
    expect(added?.id).toBeTruthy();
    expect(added?.id).not.toBe('client-supplied-id');
  });

  it('rejects a request missing sourceType', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceName: 'checkout-api.log',
      content: 'A log line.',
    });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid sourceType', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'not-a-real-source-type',
      sourceName: 'checkout-api.log',
      content: 'A log line.',
    });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a request missing sourceName', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'application-log',
      content: 'A log line.',
    });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty evidence content', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'application-log',
      sourceName: 'checkout-api.log',
      content: '',
    });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects whitespace-only evidence content', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'application-log',
      sourceName: 'checkout-api.log',
      content: '   \n\t  ',
    });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid timestamp', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'application-log',
      sourceName: 'checkout-api.log',
      content: 'A log line.',
      timestamp: 'not-a-date',
    });

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns the standard API response shape', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/evidence`).send({
      sourceType: 'application-log',
      sourceName: 'checkout-api.log',
      content: 'A log line.',
    });

    const responseBody = body<Incident>(response);
    expect(responseBody).toHaveProperty('success', true);
    expect(responseBody).toHaveProperty('data');
    expect(responseBody).toHaveProperty('error', null);
  });

  it('returns 404 for a missing incident', async () => {
    const app = buildApp();

    const response = await request(app).post('/api/incidents/does-not-exist/evidence').send({
      sourceType: 'application-log',
      sourceName: 'checkout-api.log',
      content: 'A log line.',
    });

    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('INCIDENT_NOT_FOUND');
  });
});
