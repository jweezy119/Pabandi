import { describe, expect, it } from 'vitest';
import { normalizeWorkOrder } from './mappers';

/**
 * The mapper is the only place the API's wire shape leaks into the surface.
 * These tests pin the two fields most likely to be read wrong: Prisma's
 * `_count` wrapper and the masked customer object.
 */
describe('normalizeWorkOrder', () => {
  it('flattens Prisma’s _count wrapper into auditCount', () => {
    const normalized = normalizeWorkOrder({ id: 'wo-1', _count: { auditLog: 7 } });
    expect(normalized.auditCount).toBe(7);
  });

  it('defaults auditCount to 0 when the count is missing', () => {
    const normalized = normalizeWorkOrder({ id: 'wo-1' });
    expect(normalized.auditCount).toBe(0);
  });

  it('keeps the masked customer fields the API already computed', () => {
    const normalized = normalizeWorkOrder({
      id: 'wo-1',
      customer: {
        id: 'cus-1',
        name: 'Chase Bank',
        phoneMasked: '(***) ***-2400',
        addressMasked: '1425 Chase Ave, Elk Grove Village',
      },
    });

    expect(normalized.customer).toEqual({
      id: 'cus-1',
      name: 'Chase Bank',
      phoneMasked: '(***) ***-2400',
      addressMasked: '1425 Chase Ave, Elk Grove Village',
    });
  });

  it('survives a missing customer without inventing one', () => {
    const normalized = normalizeWorkOrder({ id: 'wo-1', customer: null });
    expect(normalized.customer).toBeNull();
  });

  it('maps the server payload into the client shape', () => {
    const normalized = normalizeWorkOrder({
      id: 'wo-1',
      risk: {
        riskScore: 0.71,
        confidence: 0.82,
        band: 'high',
        policy: 'HUMAN_MANDATORY',
        calibrated: true,
        p10: 0.62,
        p50: 0.71,
        p90: 0.8,
        outOfRange: false,
        factors: [
          {
            factor: 'schedule_density',
            impact: 0.32,
            plain_language: 'Your crew already has four jobs booked today.',
          },
        ],
        features: {
          schedule_density: 4,
          lead_time_days: 1,
          issue_type_complexity: 0.8,
          technician_skill_match: 0.5,
          technician_experience_years: 12,
        },
      },
    });

    expect(normalized.risk?.score).toBe(0.71);
    expect(normalized.risk?.confidence).toBe(0.82);
    expect(normalized.risk?.band).toBe('high');
    expect(normalized.risk?.policy).toBe('HUMAN_MANDATORY');
    expect(normalized.risk?.p10).toBe(0.62);
    expect(normalized.risk?.factors[0].plainLanguage).toBe(
      'Your crew already has four jobs booked today.',
    );
    expect(normalized.risk?.features?.schedule_density).toBe(4);
  });

  it('collapses an absent range onto the point instead of inventing a spread', () => {
    const normalized = normalizeWorkOrder({
      id: 'wo-1',
      risk: { riskScore: 0.4, confidence: 0.5 },
    });

    expect(normalized.risk?.p10).toBe(0.4);
    expect(normalized.risk?.p50).toBe(0.4);
    expect(normalized.risk?.p90).toBe(0.4);
    expect(normalized.risk?.outOfRange).toBe(false);
    expect(normalized.risk?.factors).toEqual([]);
  });

  it('returns no assessment when the payload has no numeric score', () => {
    expect(normalizeWorkOrder({ id: 'wo-1', risk: null }).risk).toBeUndefined();
    expect(normalizeWorkOrder({ id: 'wo-1', risk: {} }).risk).toBeUndefined();
    // The demo stub's older `score` key must not be mistaken for the real one.
    expect(normalizeWorkOrder({ id: 'wo-1', risk: { score: 0.5 } }).risk).toBeUndefined();
  });

  it('drops a band it does not recognise rather than rendering an unknown chip', () => {
    const normalized = normalizeWorkOrder({
      id: 'wo-1',
      risk: { riskScore: 0.5, band: 'extreme' },
    });
    expect(normalized.risk?.band).toBeUndefined();
  });

  it('drops factors that carry no plain-language sentence', () => {
    const normalized = normalizeWorkOrder({
      id: 'wo-1',
      risk: {
        riskScore: 0.5,
        factors: [
          { factor: 'a', impact: 0.2, plain_language: 'A real sentence.' },
          { factor: 'b', impact: 0.1 },
        ],
      },
    });
    expect(normalized.risk?.factors).toHaveLength(1);
    expect(normalized.risk?.factors[0].factor).toBe('a');
  });

  it('falls back to zero for a feature value that is not a number', () => {
    const normalized = normalizeWorkOrder({
      id: 'wo-1',
      risk: { riskScore: 0.5, features: { schedule_density: 'four' } },
    });
    expect(normalized.risk?.features?.schedule_density).toBe(0);
  });

  it('leaves risk undefined when the model has not scored the job', () => {
    const normalized = normalizeWorkOrder({ id: 'wo-1' });
    expect(normalized.risk).toBeUndefined();
  });

  it('maps an assignment to a technician without losing the nested name', () => {
    const normalized = normalizeWorkOrder({
      id: 'wo-1',
      assignments: [
        {
          id: 'asg-1',
          technician: { id: 'tech-1', name: 'Marcus Reed', skills: ['leak_repair'], active: true },
        },
      ],
    });

    expect(normalized.assignments[0].technician.name).toBe('Marcus Reed');
    expect(normalized.assignments[0].technician.skills).toEqual(['leak_repair']);
  });

  it('falls back to a default status rather than rendering an undefined chip', () => {
    const normalized = normalizeWorkOrder({ id: 'wo-1' });
    expect(normalized.status).toBe('DRAFT');
    expect(normalized.priority).toBe('ROUTINE');
  });
});
