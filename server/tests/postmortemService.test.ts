import { describe, expect, it } from 'vitest';
import { editPostmortem, generatePostmortem } from '../src/services/postmortemService.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import { FakeAIProvider } from './helpers/FakeAIProvider.js';
import { buildAnalysisRun } from './helpers/analysisRunFixture.js';
import { buildValidPostmortemResponse } from './helpers/aiResponseFixtures.js';

function buildRepository(): InMemoryIncidentRepository {
  return new InMemoryIncidentRepository(sampleIncidents);
}

describe('generatePostmortem', () => {
  it('succeeds on the first attempt and persists the draft on the incident', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider([JSON.stringify(buildValidPostmortemResponse())]);
    const updated = await generatePostmortem(repository, provider, incident.id);

    expect(updated.postmortem?.promptVersion).toBe('postmortem-v1');
    expect(updated.postmortem?.provider).toBe('mock');
    expect(updated.postmortem?.lastEditedAt).toBeNull();
    expect(provider.callCount).toBe(1);
  });

  it('passes the latest run as completion context', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider([JSON.stringify(buildValidPostmortemResponse())]);
    await generatePostmortem(repository, provider, incident.id);

    expect(provider.contextsReceived[0]).toMatchObject({ kind: 'postmortem' });
    expect(provider.contextsReceived[0]?.analysisRun?.id).toBe(run.id);
  });

  it('regenerating replaces a previous draft entirely, including any human edits', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider([
      JSON.stringify(buildValidPostmortemResponse({ incidentSummary: 'first draft' })),
      JSON.stringify(buildValidPostmortemResponse({ incidentSummary: 'second draft' })),
    ]);

    await generatePostmortem(repository, provider, incident.id);
    await editPostmortem(repository, incident.id, { incidentSummary: 'human-edited summary' });
    const regenerated = await generatePostmortem(repository, provider, incident.id);

    expect(regenerated.postmortem?.incidentSummary).toBe('second draft');
    expect(regenerated.postmortem?.lastEditedAt).toBeNull();
  });

  it('retries once with a repair prompt when the first response is invalid', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider([
      'not valid json at all',
      JSON.stringify(buildValidPostmortemResponse()),
    ]);
    const updated = await generatePostmortem(repository, provider, incident.id);

    expect(updated.postmortem?.promptVersion).toBe('repair-invalid-json-v1');
    expect(provider.callCount).toBe(2);
  });

  it('throws a controlled error when both attempts are invalid', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);

    const provider = new FakeAIProvider(['not valid json', 'still not valid json']);

    await expect(generatePostmortem(repository, provider, incident.id)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_RESPONSE_INVALID',
    });

    const updated = await repository.findById(incident.id);
    expect(updated?.postmortem).toBeNull();
  });

  it('throws a 404 ApiError for a missing incident', async () => {
    const repository = buildRepository();
    const provider = new FakeAIProvider([JSON.stringify(buildValidPostmortemResponse())]);

    await expect(generatePostmortem(repository, provider, 'does-not-exist')).rejects.toMatchObject({
      statusCode: 404,
      code: 'INCIDENT_NOT_FOUND',
    });
  });

  it('throws a 400 error when the incident has no analysis run yet', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const provider = new FakeAIProvider([JSON.stringify(buildValidPostmortemResponse())]);

    await expect(generatePostmortem(repository, provider, incident.id)).rejects.toMatchObject({
      statusCode: 400,
      code: 'NO_ANALYSIS_FOR_POSTMORTEM',
    });
    expect(provider.callCount).toBe(0);
  });
});

describe('editPostmortem', () => {
  async function buildIncidentWithDraft() {
    const repository = buildRepository();
    const incident = sampleIncidents[0];
    const run = buildAnalysisRun(incident, incident.evidence[0].id);
    await repository.addAnalysisRun(incident.id, run);
    const provider = new FakeAIProvider([JSON.stringify(buildValidPostmortemResponse())]);
    await generatePostmortem(repository, provider, incident.id);
    return { repository, incidentId: incident.id };
  }

  it('merges the patch into the existing draft', async () => {
    const { repository, incidentId } = await buildIncidentWithDraft();

    const updated = await editPostmortem(repository, incidentId, {
      incidentSummary: 'A human-edited summary.',
    });

    expect(updated.postmortem?.incidentSummary).toBe('A human-edited summary.');
    // Untouched fields survive the merge.
    expect(updated.postmortem?.impact).toBe(buildValidPostmortemResponse().impact);
  });

  it('bumps lastEditedAt without touching generatedAt or other provenance', async () => {
    const { repository, incidentId } = await buildIncidentWithDraft();
    const before = await repository.findById(incidentId);
    const generatedAt = before?.postmortem?.generatedAt;

    const updated = await editPostmortem(repository, incidentId, { impact: 'Updated impact.' });

    expect(updated.postmortem?.lastEditedAt).not.toBeNull();
    expect(updated.postmortem?.generatedAt).toBe(generatedAt);
    expect(updated.postmortem?.provider).toBe('mock');
  });

  it('supports editing array fields wholesale', async () => {
    const { repository, incidentId } = await buildIncidentWithDraft();

    const updated = await editPostmortem(repository, incidentId, {
      followUpItems: ['A new follow-up item.'],
    });

    expect(updated.postmortem?.followUpItems).toEqual(['A new follow-up item.']);
  });

  it('throws a 404 ApiError for a missing incident', async () => {
    const repository = buildRepository();
    await expect(
      editPostmortem(repository, 'does-not-exist', { incidentSummary: 'x' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'INCIDENT_NOT_FOUND' });
  });

  it('throws a 400 error when no postmortem draft exists yet', async () => {
    const repository = buildRepository();
    const incident = sampleIncidents[0];

    await expect(
      editPostmortem(repository, incident.id, { incidentSummary: 'x' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'NO_POSTMORTEM_DRAFT' });
  });
});
