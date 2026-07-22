import { describe, expect, it } from 'vitest';
import { runSkepticReview } from '../src/services/skepticReviewService.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { FakeAIProvider } from './helpers/FakeAIProvider.js';
import { buildAnalysisRun } from './helpers/analysisRunFixture.js';
import { buildValidSkepticReviewResponse } from './helpers/aiResponseFixtures.js';

function buildRepository(): InMemoryIncidentRepository {
  return new InMemoryIncidentRepository(sampleIncidents);
}

describe('runSkepticReview', () => {
  it('succeeds on the first attempt and persists the review on the incident', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider([JSON.stringify(buildValidSkepticReviewResponse())]);
    const review = await runSkepticReview(repository, provider, incident.id);

    expect(review.promptVersion).toBe('skeptic-review-v1');
    expect(review.analysisRunId).toBe(run.id);
    expect(provider.callCount).toBe(1);

    const updated = await repository.findById(incident.id);
    expect(updated?.skepticReviews).toHaveLength(1);
    expect(updated?.skepticReviews[0]?.id).toBe(review.id);
  });

  it('records the injected provider\'s own metadata on the review, proving it uses the centralized provider rather than a hardcoded one', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider([JSON.stringify(buildValidSkepticReviewResponse())]);
    const review = await runSkepticReview(repository, provider, incident.id);

    expect(review.provider).toBe(provider.name);
    expect(review.configuredProvider).toBe(provider.configuredProvider);
    expect(review.fallbackUsed).toBe(provider.fallbackUsed);
  });

  it('never modifies the original analysis run', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider([JSON.stringify(buildValidSkepticReviewResponse())]);
    await runSkepticReview(repository, provider, incident.id);

    const updated = await repository.findById(incident.id);
    expect(updated?.analysisRuns).toHaveLength(1);
    expect(updated?.analysisRuns[0]).toEqual(run);
  });

  it('passes the run being reviewed to the provider as completion context', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider([JSON.stringify(buildValidSkepticReviewResponse())]);
    await runSkepticReview(repository, provider, incident.id);

    expect(provider.contextsReceived[0]?.analysisRun?.id).toBe(run.id);
  });

  it('reviews the latest analysis run when more than one exists', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const firstRun = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, firstRun);
    const secondRun = { ...buildAnalysisRun(incident, incident.evidence[0].id), id: 'run-second' };
    await repository.addAnalysisRun(incident.id, secondRun);

    const provider = new FakeAIProvider([JSON.stringify(buildValidSkepticReviewResponse())]);
    const review = await runSkepticReview(repository, provider, incident.id);

    expect(review.analysisRunId).toBe('run-second');
  });

  it('retries once with a repair prompt when the first response is invalid', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider([
      'not valid json at all',
      JSON.stringify(buildValidSkepticReviewResponse()),
    ]);
    const review = await runSkepticReview(repository, provider, incident.id);

    expect(review.promptVersion).toBe('repair-invalid-json-v1');
    expect(provider.callCount).toBe(2);
    expect(provider.promptsReceived[1]?.user).toContain('previous response');
  });

  it('throws a controlled error when both attempts are invalid', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider(['not valid json', 'still not valid json']);

    await expect(runSkepticReview(repository, provider, incident.id)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_RESPONSE_INVALID',
    });

    const updated = await repository.findById(incident.id);
    expect(updated?.skepticReviews).toHaveLength(0);
  });

  it('throws a 404 ApiError for a missing incident', async () => {
    const repository = buildRepository();
    const provider = new FakeAIProvider([JSON.stringify(buildValidSkepticReviewResponse())]);

    await expect(runSkepticReview(repository, provider, 'does-not-exist')).rejects.toMatchObject({
      statusCode: 404,
      code: 'INCIDENT_NOT_FOUND',
    });
  });

  it('throws a 400 error when the incident has no analysis run yet', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const provider = new FakeAIProvider([JSON.stringify(buildValidSkepticReviewResponse())]);

    await expect(runSkepticReview(repository, provider, incident.id)).rejects.toMatchObject({
      statusCode: 400,
      code: 'NO_ANALYSIS_TO_REVIEW',
    });
    expect(provider.callCount).toBe(0);
  });
});
