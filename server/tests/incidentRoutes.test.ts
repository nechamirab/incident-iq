import { beforeEach, describe, expect, it } from 'vitest';
import request, { type Response } from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { MAX_FILE_SIZE_BYTES } from '../../shared/constants/fileUpload.js';
import type { ApiResponse } from '../../shared/types/apiResponse.js';
import type { Incident } from '../../shared/types/incident.js';

function buildApp(): Express {
  return createApp({ incidentRepository: new InMemoryIncidentRepository(sampleIncidents) });
}

function body<T>(response: Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

describe('GET /api/incidents', () => {
  it('returns the seeded sample incidents', async () => {
    const response = await request(buildApp()).get('/api/incidents');
    expect(response.status).toBe(200);
    expect(body<Incident[]>(response).success).toBe(true);
    expect(body<Incident[]>(response).data).toHaveLength(sampleIncidents.length);
  });
});

describe('GET /api/incidents/:incidentId', () => {
  it('returns a single incident by id', async () => {
    const response = await request(buildApp()).get(`/api/incidents/${sampleIncidents[0].id}`);
    expect(response.status).toBe(200);
    expect(body<Incident>(response).data?.id).toBe(sampleIncidents[0].id);
  });

  it('returns 404 for a missing incident', async () => {
    const response = await request(buildApp()).get('/api/incidents/does-not-exist');
    expect(response.status).toBe(404);
    expect(body<null>(response).success).toBe(false);
    expect(body<null>(response).error?.code).toBe('INCIDENT_NOT_FOUND');
  });
});

describe('POST /api/incidents', () => {
  let app: Express;

  beforeEach(() => {
    app = buildApp();
  });

  it('creates an incident from text fields alone', async () => {
    const response = await request(app)
      .post('/api/incidents')
      .field('title', 'Checkout failures')
      .field('description', 'Customers cannot complete checkout.')
      .field('severity', 'critical')
      .field('affectedService', 'checkout-api')
      .field('detectedAt', '2026-07-01T00:00:00Z')
      .field('applicationLogs', 'error line one\nerror line two');

    expect(response.status).toBe(201);
    const created = body<Incident>(response);
    expect(created.success).toBe(true);
    expect(created.data?.status).toBe('draft');
    expect(created.data?.evidence.length).toBeGreaterThanOrEqual(3); // description + 2 log lines
  });

  it('creates an incident with an uploaded .txt file', async () => {
    const response = await request(app)
      .post('/api/incidents')
      .field('title', 'Checkout failures')
      .field('description', 'Customers cannot complete checkout.')
      .field('severity', 'high')
      .field('affectedService', 'checkout-api')
      .field('detectedAt', '2026-07-01T00:00:00Z')
      .attach('files', Buffer.from('line one\nline two'), 'notes.txt');

    expect(response.status).toBe(201);
    const uploadedEvidence = (body<Incident>(response).data?.evidence ?? []).filter(
      (item) => item.sourceName === 'notes.txt',
    );
    expect(uploadedEvidence).toHaveLength(2);
    expect(uploadedEvidence[0]?.sourceType).toBe('uploaded-file');
  });

  it('creates an incident with an uploaded .json file', async () => {
    const response = await request(app)
      .post('/api/incidents')
      .field('title', 'Checkout failures')
      .field('description', 'Customers cannot complete checkout.')
      .field('severity', 'high')
      .field('affectedService', 'checkout-api')
      .field('detectedAt', '2026-07-01T00:00:00Z')
      .attach(
        'files',
        Buffer.from(JSON.stringify([{ message: 'a' }, { message: 'b' }])),
        'events.json',
      );

    expect(response.status).toBe(201);
    const uploadedEvidence = (body<Incident>(response).data?.evidence ?? []).filter(
      (item) => item.sourceName === 'events.json',
    );
    expect(uploadedEvidence).toHaveLength(2);
  });

  it('rejects an uploaded file with invalid JSON', async () => {
    const response = await request(app)
      .post('/api/incidents')
      .field('title', 'Checkout failures')
      .field('description', 'Customers cannot complete checkout.')
      .field('severity', 'high')
      .field('affectedService', 'checkout-api')
      .field('detectedAt', '2026-07-01T00:00:00Z')
      .attach('files', Buffer.from('{ not valid json'), 'bad.json');

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('INVALID_JSON_FILE');
  });

  it('rejects an unsupported file extension', async () => {
    const response = await request(app)
      .post('/api/incidents')
      .field('title', 'Checkout failures')
      .field('description', 'Customers cannot complete checkout.')
      .field('severity', 'high')
      .field('affectedService', 'checkout-api')
      .field('detectedAt', '2026-07-01T00:00:00Z')
      .attach('files', Buffer.from('binary-ish content'), 'malware.exe');

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects a file larger than the size limit', async () => {
    const response = await request(app)
      .post('/api/incidents')
      .field('title', 'Checkout failures')
      .field('description', 'Customers cannot complete checkout.')
      .field('severity', 'high')
      .field('affectedService', 'checkout-api')
      .field('detectedAt', '2026-07-01T00:00:00Z')
      .attach('files', Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 'a'), 'huge.txt');

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('FILE_UPLOAD_LIMIT_FILE_SIZE');
  });

  it('rejects a submission missing a required field', async () => {
    const response = await request(app)
      .post('/api/incidents')
      .field('description', 'Customers cannot complete checkout.')
      .field('severity', 'high')
      .field('affectedService', 'checkout-api')
      .field('detectedAt', '2026-07-01T00:00:00Z');

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid severity value', async () => {
    const response = await request(app)
      .post('/api/incidents')
      .field('title', 'Checkout failures')
      .field('description', 'Customers cannot complete checkout.')
      .field('severity', 'catastrophic')
      .field('affectedService', 'checkout-api')
      .field('detectedAt', '2026-07-01T00:00:00Z');

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('persists the created incident so it can be fetched afterward', async () => {
    const createResponse = await request(app)
      .post('/api/incidents')
      .field('title', 'Checkout failures')
      .field('description', 'Customers cannot complete checkout.')
      .field('severity', 'high')
      .field('affectedService', 'checkout-api')
      .field('detectedAt', '2026-07-01T00:00:00Z');

    const incidentId = body<Incident>(createResponse).data?.id;
    const getResponse = await request(app).get(`/api/incidents/${incidentId}`);

    expect(getResponse.status).toBe(200);
    expect(body<Incident>(getResponse).data?.title).toBe('Checkout failures');
  });
});
