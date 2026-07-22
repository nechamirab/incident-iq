import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { MockAIProvider } from '../src/ai/providers/MockAIProvider.js';
import type { ApiResponse } from '../../shared/types/apiResponse.js';
import type { Incident } from '../../shared/types/incident.js';
import type { SkepticReview } from '../../shared/types/skepticReview.js';

function buildApp(): Express {
  return createApp({
    incidentRepository: new InMemoryIncidentRepository(sampleIncidents),
    aiProvider: new MockAIProvider(),
  });
}

function body<T>(response: request.Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

describe('POST /api/incidents/:incidentId/skeptic-review', () => {
  it('reviews the leading hypothesis of the most recent analysis run', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const analyzeResponse = await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const run = body<{ id: string; hypotheses: Array<{ id: string; confidence: number }> }>(
      analyzeResponse,
    ).data;
    const leading = [...(run?.hypotheses ?? [])].sort((a, b) => b.confidence - a.confidence)[0];

    const reviewResponse = await request(app).post(`/api/incidents/${incidentId}/skeptic-review`);

    expect(reviewResponse.status).toBe(201);
    const review = body<SkepticReview>(reviewResponse).data;
    expect(review?.analysisRunId).toBe(run?.id);
    expect(review?.challengedHypothesisId).toBe(leading?.id);
    expect(review?.promptVersion).toBe('skeptic-review-v1');
    expect(review?.humanNotes).toBeNull();
  });

  it('persists the review on the incident, alongside the untouched analysis run', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);
    await request(app).post(`/api/incidents/${incidentId}/skeptic-review`);

    const getResponse = await request(app).get(`/api/incidents/${incidentId}`);
    const incident = body<Incident>(getResponse).data;
    expect(incident?.skepticReviews).toHaveLength(1);
    expect(incident?.analysisRuns).toHaveLength(1);
  });

  it('returns 400 when the incident has no analysis run yet', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;

    const response = await request(app).post(`/api/incidents/${incidentId}/skeptic-review`);
    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('NO_ANALYSIS_TO_REVIEW');
  });

  it('returns 404 for a missing incident', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/incidents/does-not-exist/skeptic-review');
    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('INCIDENT_NOT_FOUND');
  });
});

describe('PATCH /api/incidents/:incidentId/skeptic-reviews/:reviewId/notes', () => {
  it('records human review notes on a skeptic review', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const reviewResponse = await request(app).post(`/api/incidents/${incidentId}/skeptic-review`);
    const reviewId = body<SkepticReview>(reviewResponse).data?.id;

    const notesResponse = await request(app)
      .patch(`/api/incidents/${incidentId}/skeptic-reviews/${reviewId}/notes`)
      .send({ humanNotes: 'Reviewed by Jordan; agree the leading hypothesis needs more evidence.' });

    expect(notesResponse.status).toBe(200);
    const updatedIncident = body<Incident>(notesResponse).data;
    const updatedReview = updatedIncident?.skepticReviews.find((review) => review.id === reviewId);
    expect(updatedReview?.humanNotes).toBe(
      'Reviewed by Jordan; agree the leading hypothesis needs more evidence.',
    );
  });

  it('allows clearing notes back to an empty string', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const reviewResponse = await request(app).post(`/api/incidents/${incidentId}/skeptic-review`);
    const reviewId = body<SkepticReview>(reviewResponse).data?.id;

    await request(app)
      .patch(`/api/incidents/${incidentId}/skeptic-reviews/${reviewId}/notes`)
      .send({ humanNotes: 'first note' });
    const clearedResponse = await request(app)
      .patch(`/api/incidents/${incidentId}/skeptic-reviews/${reviewId}/notes`)
      .send({ humanNotes: '' });

    const updatedReview = body<Incident>(clearedResponse).data?.skepticReviews.find(
      (review) => review.id === reviewId,
    );
    expect(updatedReview?.humanNotes).toBe('');
  });

  it('returns 404 for a missing skeptic review id', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/skeptic-reviews/does-not-exist/notes`)
      .send({ humanNotes: 'x' });

    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('SKEPTIC_REVIEW_NOT_FOUND');
  });

  it('returns 404 for a missing incident', async () => {
    const app = buildApp();
    const response = await request(app)
      .patch('/api/incidents/does-not-exist/skeptic-reviews/review-1/notes')
      .send({ humanNotes: 'x' });

    expect(response.status).toBe(404);
    expect(body<null>(response).error?.code).toBe('SKEPTIC_REVIEW_NOT_FOUND');
  });

  it('returns 400 when humanNotes is missing from the request body', async () => {
    const app = buildApp();
    const incidentId = sampleIncidents[0].id;
    await request(app).post(`/api/incidents/${incidentId}/analyze`);
    const reviewResponse = await request(app).post(`/api/incidents/${incidentId}/skeptic-review`);
    const reviewId = body<SkepticReview>(reviewResponse).data?.id;

    const response = await request(app)
      .patch(`/api/incidents/${incidentId}/skeptic-reviews/${reviewId}/notes`)
      .send({});

    expect(response.status).toBe(400);
    expect(body<null>(response).error?.code).toBe('VALIDATION_ERROR');
  });
});
