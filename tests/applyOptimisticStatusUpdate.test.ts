import { describe, expect, it } from 'vitest';
import { applyOptimisticStatusUpdate } from '../src/utils/applyOptimisticStatusUpdate';
import { buildIncident } from './helpers/incidentFixture';

describe('applyOptimisticStatusUpdate', () => {
  it('sets status and resolvedAt when resolving with a supplied timestamp', () => {
    const incident = buildIncident({ status: 'draft', resolvedAt: null });
    const updated = applyOptimisticStatusUpdate(incident, {
      status: 'resolved',
      resolvedAt: '2026-07-01T12:00:00Z',
    });

    expect(updated.status).toBe('resolved');
    expect(updated.resolvedAt).toBe('2026-07-01T12:00:00Z');
  });

  it('falls back to a fresh timestamp when resolving without one supplied', () => {
    const incident = buildIncident({ status: 'draft', resolvedAt: null });
    const before = Date.now();
    const updated = applyOptimisticStatusUpdate(incident, { status: 'resolved' });

    expect(updated.resolvedAt).not.toBeNull();
    expect(Date.parse(updated.resolvedAt as string)).toBeGreaterThanOrEqual(before);
  });

  it('clears resolvedAt when reopening a resolved incident', () => {
    const incident = buildIncident({ status: 'resolved', resolvedAt: '2026-06-01T00:00:00Z' });
    const updated = applyOptimisticStatusUpdate(incident, { status: 'under-investigation' });

    expect(updated.status).toBe('under-investigation');
    expect(updated.resolvedAt).toBeNull();
  });

  it('preserves resolvedAt when archiving a previously resolved incident', () => {
    const incident = buildIncident({ status: 'resolved', resolvedAt: '2026-06-01T00:00:00Z' });
    const updated = applyOptimisticStatusUpdate(incident, { status: 'archived' });

    expect(updated.status).toBe('archived');
    expect(updated.resolvedAt).toBe('2026-06-01T00:00:00Z');
  });

  it('does not invent a resolvedAt when archiving an incident that was never resolved', () => {
    const incident = buildIncident({ status: 'draft', resolvedAt: null });
    const updated = applyOptimisticStatusUpdate(incident, { status: 'archived' });

    expect(updated.resolvedAt).toBeNull();
  });

  it('preserves existing resolutionNotes when the payload omits them', () => {
    const incident = buildIncident({
      status: 'resolved',
      resolvedAt: '2026-06-01T00:00:00Z',
      resolutionNotes: 'Original notes.',
    });
    const updated = applyOptimisticStatusUpdate(incident, { status: 'under-investigation' });

    expect(updated.resolutionNotes).toBe('Original notes.');
  });

  it('overwrites resolutionNotes when the payload explicitly supplies them', () => {
    const incident = buildIncident({ status: 'draft', resolutionNotes: 'Old notes.' });
    const updated = applyOptimisticStatusUpdate(incident, {
      status: 'resolved',
      resolvedAt: '2026-07-01T12:00:00Z',
      resolutionNotes: 'New notes.',
    });

    expect(updated.resolutionNotes).toBe('New notes.');
  });

  it('does not mutate the original incident object', () => {
    const incident = buildIncident({ status: 'draft', resolvedAt: null });
    applyOptimisticStatusUpdate(incident, { status: 'resolved', resolvedAt: '2026-07-01T12:00:00Z' });

    expect(incident.status).toBe('draft');
    expect(incident.resolvedAt).toBeNull();
  });

  it('bumps updatedAt', () => {
    const incident = buildIncident({ status: 'draft', updatedAt: '2026-01-01T00:00:00Z' });
    const updated = applyOptimisticStatusUpdate(incident, { status: 'archived' });

    expect(updated.updatedAt).not.toBe('2026-01-01T00:00:00Z');
  });
});
