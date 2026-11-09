import { describe, expect, it } from 'vitest';
import {
  applyDemoRisk,
  DEMO_WORK_ORDER_IDS,
  getDemoRisk,
  isDemoMode,
  toRiskAssessment,
} from './demoRiskProvider';
import type { WorkOrder } from './types';

/**
 * The demo stub is a stand-in for the Phase 4 model, so the things worth
 * pinning are the guarantees that survive the swap: it covers exactly the six
 * seeded jobs, it never invents a score for anything else, and it maps onto
 * the surface's shape without reshaping the real API.
 */
describe('demoRiskProvider', () => {
  it('covers exactly the six seeded demo work orders', () => {
    for (const id of DEMO_WORK_ORDER_IDS) {
      expect(getDemoRisk(id)).toBeDefined();
    }
    expect(DEMO_WORK_ORDER_IDS).toHaveLength(6);
  });

  it('returns undefined for anything that is not a seeded demo job', () => {
    expect(getDemoRisk('wo-1425')).toBeUndefined();
    expect(getDemoRisk('')).toBeUndefined();
  });

  it('gives the demo jobs distinct, deterministic scores', () => {
    const first = DEMO_WORK_ORDER_IDS.map((id) => getDemoRisk(id)!.risk);
    const second = DEMO_WORK_ORDER_IDS.map((id) => getDemoRisk(id)!.risk);

    expect(first).toEqual(second);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it('maps the stub onto the shape the surface renders', () => {
    const assessment = toRiskAssessment(getDemoRisk('demo-wo-01')!);

    expect(assessment.score).toBe(0.71);
    expect(assessment.band).toBe('high');
    expect(assessment.p10).toBeLessThan(assessment.score);
    expect(assessment.p90).toBeGreaterThan(assessment.score);
    expect(assessment.outOfRange).toBe(false);
    // The stub's snake_case field becomes the surface's camelCase field.
    expect(assessment.factors[0].plainLanguage).toContain('four jobs booked');
    expect(typeof assessment.factors[0].impact).toBe('number');
  });

  it('leaves non-demo work orders alone when demo mode is off', () => {
    const workOrders: WorkOrder[] = [
      { id: 'demo-wo-01' } as WorkOrder,
      { id: 'wo-1425' } as WorkOrder,
    ];

    // Demo mode is off in the test environment, so nothing is rewritten.
    expect(isDemoMode()).toBe(false);
    expect(applyDemoRisk(workOrders)).toBe(workOrders);
  });
});
