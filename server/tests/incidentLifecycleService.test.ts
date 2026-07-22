import { describe, expect, it } from 'vitest';
import { computeResolvedAt, updateIncidentStatus } from '../src/services/incidentLifecycleService.js';
import { InMemoryIncidentRepository } from '../src/repositories/InMemoryIncidentRepository.js';
import { sampleIncidents } from '../src/data/incidents/index.js';
import type { Incident } from '../../shared/types/incident.js';

function buildRepository(): InMemoryIncidentRepository {
  return new InMemoryIncidentRepository(sampleIncidents);
}

describe('computeResolvedAt', () => {
  const draftIncident: Incident = { ...sampleIncidents[0], status: 'draft', resolvedAt: null };
  const resolvedIncident: Incident = {
    ...sampleIncidents[0],
    status: 'resolved',
    resolvedAt: '2026-06-14T16:00:00Z',
  };

  it('sets resolvedAt to the requested timestamp when moving to "resolved"', () => {
    const result = computeResolvedAt(draftIncident, 'resolved', '2026-07-01T12:00:00Z');
    expect(result).toBe('2026-07-01T12:00:00Z');
  });

  it('falls back to a fresh timestamp when moving to "resolved" without one supplied', () => {
    const before = Date.now();
    const result = computeResolvedAt(draftIncident, 'resolved', undefined);
    expect(result).not.toBeNull();
    expect(Date.parse(result as string)).toBeGreaterThanOrEqual(before);
  });

  it('clears resolvedAt when reopening a resolved incident to "under-investigation"', () => {
    const result = computeResolvedAt(resolvedIncident, 'under-investigation', undefined);
    expect(result).toBeNull();
  });

  it('clears resolvedAt when reopening a resolved incident to "draft"', () => {
    const result = computeResolvedAt(resolvedIncident, 'draft', undefined);
    expect(result).toBeNull();
  });

  it('preserves resolvedAt when archiving an incident that was previously resolved', () => {
    const result = computeResolvedAt(resolvedIncident, 'archived', undefined);
    expect(result).toBe('2026-06-14T16:00:00Z');
  });

  it('does not invent a resolvedAt when archiving an incident that was never resolved', () => {
    const result = computeResolvedAt(draftIncident, 'archived', undefined);
    expect(result).toBeNull();
  });
});

describe('updateIncidentStatus', () => {
  it('persists a non-resolution status change', async () => {
    const repository = buildRepository();
    const incidentId = sampleIncidents[0].id;

    const updated = await updateIncidentStatus(repository, incidentId, {
      status: 'under-investigation',
    });

    expect(updated.status).toBe('under-investigation');
    expect(updated.resolvedAt).toBeNull();
  });

  it('persists resolvedAt and resolutionNotes when resolving', async () => {
    const repository = buildRepository();
    const incidentId = sampleIncidents[0].id;

    const updated = await updateIncidentStatus(repository, incidentId, {
      status: 'resolved',
      resolvedAt: '2026-07-01T12:00:00Z',
      resolutionNotes: 'Reverted the connection pool change.',
    });

    expect(updated.status).toBe('resolved');
    expect(updated.resolvedAt).toBe('2026-07-01T12:00:00Z');
    expect(updated.resolutionNotes).toBe('Reverted the connection pool change.');
  });

  it('preserves existing resolutionNotes when reopening without supplying new notes', async () => {
    const repository = buildRepository();
    const incidentId = sampleIncidents[0].id;

    await updateIncidentStatus(repository, incidentId, {
      status: 'resolved',
      resolvedAt: '2026-07-01T12:00:00Z',
      resolutionNotes: 'Original resolution notes.',
    });

    const reopened = await updateIncidentStatus(repository, incidentId, {
      status: 'under-investigation',
    });

    expect(reopened.resolvedAt).toBeNull();
    expect(reopened.resolutionNotes).toBe('Original resolution notes.');
  });

  it('overwrites resolutionNotes when a status update explicitly supplies new ones', async () => {
    const repository = buildRepository();
    const incidentId = sampleIncidents[0].id;

    await updateIncidentStatus(repository, incidentId, {
      status: 'resolved',
      resolvedAt: '2026-07-01T12:00:00Z',
      resolutionNotes: 'Original notes.',
    });

    const updated = await updateIncidentStatus(repository, incidentId, {
      status: 'resolved',
      resolvedAt: '2026-07-02T12:00:00Z',
      resolutionNotes: 'Updated notes.',
    });

    expect(updated.resolutionNotes).toBe('Updated notes.');
  });

  it('bumps updatedAt on a successful status change', async () => {
    const repository = buildRepository();
    const incidentId = sampleIncidents[0].id;
    const before = await repository.findById(incidentId);

    const updated = await updateIncidentStatus(repository, incidentId, { status: 'archived' });

    expect(updated.updatedAt).not.toBe(before?.updatedAt);
  });

  it('throws a 404 ApiError for a missing incident', async () => {
    const repository = buildRepository();

    await expect(
      updateIncidentStatus(repository, 'does-not-exist', { status: 'archived' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'INCIDENT_NOT_FOUND' });
  });
});
