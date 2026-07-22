import { describe, expect, it } from 'vitest';
import { buildPostmortemMarkdown } from '../src/utils/buildPostmortemMarkdown';
import { buildIncident } from './helpers/incidentFixture';
import type { Postmortem } from '../shared/types/postmortem';

function buildPostmortem(overrides: Partial<Postmortem> = {}): Postmortem {
  return {
    incidentSummary: 'Checkout failures following a deployment.',
    impact: 'Customers could not check out for 40 minutes.',
    detection: 'Detected via a monitoring alert.',
    timeline: '3 events were reconstructed.',
    contributingFactors: ['Reduced DB connection pool size.'],
    hypothesesInvestigated: ['Connection pool exhaustion -- confidence 70/100.'],
    likelyCause: 'The available evidence suggests connection pool exhaustion.',
    uncertaintyStatement: 'This has not been independently confirmed.',
    resolution: 'This incident has not yet been marked resolved.',
    correctiveActions: ['Add a load test gate for pool-affecting config changes.'],
    lessonsLearned: ['Config changes need the same review as code.'],
    followUpItems: ['Confirm with the on-call engineer.'],
    provider: 'mock',
    model: 'mock-deterministic-v1',
    promptVersion: 'postmortem-v1',
    generatedAt: '2026-07-01T00:20:00Z',
    lastEditedAt: null,
    ...overrides,
  };
}

describe('buildPostmortemMarkdown', () => {
  it('includes the incident title as the top-level heading', () => {
    const incident = buildIncident({ title: 'Checkout failures after v2.4.1 deployment' });
    const markdown = buildPostmortemMarkdown(incident, buildPostmortem());
    expect(markdown).toContain('# Postmortem: Checkout failures after v2.4.1 deployment');
  });

  it('includes incident metadata (severity, status, affected service)', () => {
    const incident = buildIncident({ severity: 'critical', status: 'draft', affectedService: 'checkout-api' });
    const markdown = buildPostmortemMarkdown(incident, buildPostmortem());
    expect(markdown).toContain('critical');
    expect(markdown).toContain('draft');
    expect(markdown).toContain('checkout-api');
  });

  it('says "Not yet resolved" when resolvedAt is null', () => {
    const incident = buildIncident({ resolvedAt: null });
    const markdown = buildPostmortemMarkdown(incident, buildPostmortem());
    expect(markdown).toContain('Not yet resolved');
  });

  it('includes the resolvedAt timestamp when present', () => {
    const incident = buildIncident({ resolvedAt: '2026-06-14T16:00:00Z' });
    const markdown = buildPostmortemMarkdown(incident, buildPostmortem());
    expect(markdown).toContain('2026-06-14T16:00:00Z');
  });

  it('includes every content field under its own heading', () => {
    const incident = buildIncident();
    const markdown = buildPostmortemMarkdown(incident, buildPostmortem());
    expect(markdown).toContain('## Incident Summary');
    expect(markdown).toContain('Checkout failures following a deployment.');
    expect(markdown).toContain('## Likely Cause');
    expect(markdown).toContain('The available evidence suggests connection pool exhaustion.');
    expect(markdown).toContain('## Corrective Actions');
    expect(markdown).toContain('- Add a load test gate for pool-affecting config changes.');
  });

  it('renders "_None recorded._" for an empty array field instead of an empty list', () => {
    const incident = buildIncident();
    const markdown = buildPostmortemMarkdown(incident, buildPostmortem({ followUpItems: [] }));
    expect(markdown).toContain('_None recorded._');
  });

  it('includes provenance and never-edited status in the footer', () => {
    const incident = buildIncident();
    const markdown = buildPostmortemMarkdown(incident, buildPostmortem());
    expect(markdown).toContain('mock/mock-deterministic-v1');
    expect(markdown).toContain('postmortem-v1');
    expect(markdown).toContain('Last edited: never.');
  });

  it('reports the lastEditedAt timestamp when the draft has been edited', () => {
    const incident = buildIncident();
    const markdown = buildPostmortemMarkdown(
      incident,
      buildPostmortem({ lastEditedAt: '2026-07-01T01:00:00Z' }),
    );
    expect(markdown).toContain('Last edited: 2026-07-01T01:00:00Z.');
  });
});
