import { describe, expect, it } from 'vitest';
import { analyzeIncident } from '../src/services/analysisService.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { FakeAIProvider } from './helpers/FakeAIProvider.js';
import { buildValidAiResponse } from './helpers/aiResponseFixtures.js';
import type { AIPrompt, AIProvider } from '../src/ai/providers/AIProvider.js';
import type { Incident } from '../../shared/types/incident.js';
import { ApiError } from '../src/utils/ApiError.js';

function buildRepository(): InMemoryIncidentRepository {
  return new InMemoryIncidentRepository(sampleIncidents);
}

describe('analyzeIncident', () => {
  it('succeeds on the first attempt and persists the run on the incident', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const provider = new FakeAIProvider([
      JSON.stringify(buildValidAiResponse({}, incident.evidence[0].id)),
    ]);

    const run = await analyzeIncident(repository, provider, incident.id);

    expect(run.status).toBe('completed');
    expect(run.promptVersion).toBe('incident-analysis-v1');
    expect(provider.callCount).toBe(1);

    const updated = await repository.findById(incident.id);
    expect(updated?.status).toBe('under-investigation');
    expect(updated?.analysisRuns).toHaveLength(1);
    expect(updated?.analysisRuns[0]?.id).toBe(run.id);
  });

  it('marks the incident "analyzing" while the request is in flight', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    let statusDuringCall: string | undefined;

    const probingProvider: AIProvider = {
      name: 'mock',
      model: 'probe',
      async complete(_incident: Incident, _prompt: AIPrompt): Promise<string> {
        statusDuringCall = (await repository.findById(incident.id))?.status;
        return JSON.stringify(buildValidAiResponse({}, incident.evidence[0].id));
      },
    };

    await analyzeIncident(repository, probingProvider, incident.id);
    expect(statusDuringCall).toBe('analyzing');
  });

  it('retries once with a repair prompt when the first response is invalid', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const provider = new FakeAIProvider([
      'not valid json at all',
      JSON.stringify(buildValidAiResponse({}, incident.evidence[0].id)),
    ]);

    const run = await analyzeIncident(repository, provider, incident.id);

    expect(run.status).toBe('completed');
    expect(run.promptVersion).toBe('repair-invalid-json-v1');
    expect(provider.callCount).toBe(2);
    expect(provider.promptsReceived[1]?.user).toContain('previous response');
  });

  it('throws a controlled error and reverts incident status when both attempts are invalid', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const provider = new FakeAIProvider(['not valid json', 'still not valid json']);

    await expect(analyzeIncident(repository, provider, incident.id)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_RESPONSE_INVALID',
    });

    const updated = await repository.findById(incident.id);
    expect(updated?.status).toBe('draft');
    expect(updated?.analysisRuns).toHaveLength(0);
  });

  it('reverts incident status when the provider itself throws', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const provider = new FakeAIProvider([new Error('network exploded')]);

    await expect(analyzeIncident(repository, provider, incident.id)).rejects.toThrow(
      'network exploded',
    );

    const updated = await repository.findById(incident.id);
    expect(updated?.status).toBe('draft');
  });

  it('throws a 404 ApiError for a missing incident', async () => {
    const repository = buildRepository();
    const provider = new FakeAIProvider([JSON.stringify(buildValidAiResponse())]);

    await expect(analyzeIncident(repository, provider, 'does-not-exist')).rejects.toMatchObject({
      statusCode: 404,
      code: 'INCIDENT_NOT_FOUND',
    });
  });

  it('does not downgrade an already-resolved incident back to under-investigation', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    await repository.update(incident.id, { status: 'resolved' });

    const provider = new FakeAIProvider([
      JSON.stringify(buildValidAiResponse({}, incident.evidence[0].id)),
    ]);
    await analyzeIncident(repository, provider, incident.id);

    const updated = await repository.findById(incident.id);
    expect(updated?.status).toBe('resolved');
  });

  it('rejects when ApiError is thrown by a misconfigured provider (e.g. missing Anthropic key)', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const provider = new FakeAIProvider([
      new ApiError(503, 'AI_PROVIDER_NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not configured.'),
    ]);

    await expect(analyzeIncident(repository, provider, incident.id)).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_PROVIDER_NOT_CONFIGURED',
    });

    const updated = await repository.findById(incident.id);
    expect(updated?.status).toBe('draft');
  });
});
