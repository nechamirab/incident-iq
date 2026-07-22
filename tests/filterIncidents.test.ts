import { describe, expect, it } from 'vitest';
import {
  filterIncidents,
  INCIDENT_SEVERITY_FILTER_ALL,
  INCIDENT_STATUS_FILTER_ALL,
} from '../src/utils/filterIncidents';
import { buildIncident } from './helpers/incidentFixture';

describe('filterIncidents', () => {
  const checkout = buildIncident({
    id: 'sample-ecommerce-checkout',
    title: 'Checkout failures after v2.4.1 deployment',
    affectedService: 'checkout-api',
    status: 'under-investigation',
    severity: 'critical',
  });
  const login = buildIncident({
    id: 'sample-mobile-login-failure',
    title: 'Mobile login failures',
    affectedService: 'auth-service',
    status: 'draft',
    severity: 'medium',
  });
  const incidents = [checkout, login];

  it('returns everything when search is empty and filters are "all"', () => {
    const result = filterIncidents(incidents, {
      search: '',
      status: INCIDENT_STATUS_FILTER_ALL,
      severity: INCIDENT_SEVERITY_FILTER_ALL,
    });
    expect(result).toHaveLength(2);
  });

  it('filters by status', () => {
    const result = filterIncidents(incidents, {
      search: '',
      status: 'draft',
      severity: INCIDENT_SEVERITY_FILTER_ALL,
    });
    expect(result).toEqual([login]);
  });

  it('filters by severity', () => {
    const result = filterIncidents(incidents, {
      search: '',
      status: INCIDENT_STATUS_FILTER_ALL,
      severity: 'critical',
    });
    expect(result).toEqual([checkout]);
  });

  it('matches search text against title, case-insensitively', () => {
    const result = filterIncidents(incidents, {
      search: 'CHECKOUT',
      status: INCIDENT_STATUS_FILTER_ALL,
      severity: INCIDENT_SEVERITY_FILTER_ALL,
    });
    expect(result).toEqual([checkout]);
  });

  it('matches search text against affected service', () => {
    const result = filterIncidents(incidents, {
      search: 'auth-service',
      status: INCIDENT_STATUS_FILTER_ALL,
      severity: INCIDENT_SEVERITY_FILTER_ALL,
    });
    expect(result).toEqual([login]);
  });

  it('matches search text against incident id', () => {
    const result = filterIncidents(incidents, {
      search: 'mobile-login',
      status: INCIDENT_STATUS_FILTER_ALL,
      severity: INCIDENT_SEVERITY_FILTER_ALL,
    });
    expect(result).toEqual([login]);
  });

  it('combines search, status, and severity filters (AND, not OR)', () => {
    const result = filterIncidents(incidents, {
      search: 'checkout',
      status: 'draft',
      severity: INCIDENT_SEVERITY_FILTER_ALL,
    });
    expect(result).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    const result = filterIncidents(incidents, {
      search: 'nonexistent',
      status: INCIDENT_STATUS_FILTER_ALL,
      severity: INCIDENT_SEVERITY_FILTER_ALL,
    });
    expect(result).toEqual([]);
  });
});
