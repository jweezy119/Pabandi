import type { RiskAssessment, RiskBand, WorkOrder, WorkOrderFeatures } from './types';

/**
 * DEMO_MODE risk stub.
 *
 * ⚠️  THIS IS NOT THE REAL PREDICTIVE ENGINE. It exists so the A-1 Roofing
 * pitch can show risk chips, explanation bars and the what-if strip before
 * Phase 4 lands the hierarchical-Bayesian model.
 *
 * The shape below is deliberately NOT the real API contract. The real
 * `RiskAssessment` (types.ts) carries a counterfactual range, a confidence and
 * an out-of-range flag, because §7 requires ranges rather than point
 * estimates. This stub returns a single `risk` number and the adapter at the
 * bottom derives the range. Do not let this shape leak into the real
 * endpoint: Phase 4 replaces this module and must not be constrained by it.
 *
 * Env: the client cannot read `process.env.DEMO_MODE` (Vite only exposes
 * VITE_-prefixed variables), so the demo deployment sets `VITE_DEMO_MODE=true`
 * alongside the server's `DEMO_MODE=true`.
 */

export interface DemoRiskFactor {
  factor: string;
  impact: number;
  plain_language: string;
}

export interface DemoRisk {
  risk: number;
  band: RiskBand;
  factors: DemoRiskFactor[];
}

/**
 * The six work orders Phase 6 seeds for the A-1 Roofing demo. Keyed by the id
 * the seeder will use, so the numbers a coordinator sees during the pitch are
 * the same numbers every time.
 */
export const DEMO_WORK_ORDER_IDS = [
  'demo-wo-01',
  'demo-wo-02',
  'demo-wo-03',
  'demo-wo-04',
  'demo-wo-05',
  'demo-wo-06',
] as const;

const DEMO_RISK: Record<string, DemoRisk> = {
  'demo-wo-01': {
    risk: 0.71,
    band: 'high',
    factors: [
      {
        factor: 'schedule_density_today',
        impact: 0.32,
        plain_language: 'Your crew already has four jobs booked today, which makes it harder to reach this one on time.',
      },
      {
        factor: 'precipitation_forecast',
        impact: 0.18,
        plain_language: 'More rain is expected this afternoon, so the leak is likely to get worse before it gets better.',
      },
      {
        factor: 'technician_experience_years',
        impact: -0.09,
        plain_language: 'Marcus has been doing this work for twelve years, which lowers the chance of a problem.',
      },
    ],
  },
  'demo-wo-02': {
    risk: 0.22,
    band: 'low',
    factors: [
      {
        factor: 'schedule_density_today',
        impact: -0.11,
        plain_language: 'The day is still fairly open, so there is plenty of room to fit this job in.',
      },
      {
        factor: 'roof_age_years',
        impact: 0.06,
        plain_language: 'The roof is eighteen years old, which adds a little uncertainty to the inspection.',
      },
    ],
  },
  'demo-wo-03': {
    risk: 0.48,
    band: 'medium',
    factors: [
      {
        factor: 'parts_availability',
        impact: 0.21,
        plain_language: 'One of the belts is not in stock locally, so it may need to be ordered before the work can finish.',
      },
      {
        factor: 'technician_experience_years',
        impact: -0.07,
        plain_language: 'Dana has serviced this exact unit twice before, which lowers the chance of a surprise.',
      },
    ],
  },
  'demo-wo-04': {
    risk: 0.84,
    band: 'high',
    factors: [
      {
        factor: 'lead_time_hours',
        impact: 0.27,
        plain_language: 'The job was booked only three hours ago, so the crew has had little time to prepare.',
      },
      {
        factor: 'building_access_complexity',
        impact: 0.16,
        plain_language: 'The roof hatch requires a permit badge that has to be signed out in advance.',
      },
    ],
  },
  'demo-wo-05': {
    risk: 0.35,
    band: 'medium',
    factors: [
      {
        factor: 'weather_window_stability',
        impact: 0.12,
        plain_language: 'The forecast could change by Friday, which may push the outdoor work to another day.',
      },
    ],
  },
  'demo-wo-06': {
    risk: 0.12,
    band: 'low',
    factors: [
      {
        factor: 'repeat_customer_history',
        impact: -0.14,
        plain_language: 'This customer has used you four times before, so you already know the building and how to get in.',
      },
    ],
  },
};

/**
 * Feature values for the demo jobs, so the what-if strip has somewhere to
 * start. The real endpoint derives these from the work order; the demo
 * database has no history to derive them from, so they are written down here.
 */
const DEMO_FEATURES: Record<string, WorkOrderFeatures> = {
  'demo-wo-01': {
    schedule_density: 4,
    lead_time_days: 1,
    issue_type_complexity: 0.8,
    technician_skill_match: 0.5,
    technician_experience_years: 12,
  },
  'demo-wo-02': {
    schedule_density: 1,
    lead_time_days: 5,
    issue_type_complexity: 0.3,
    technician_skill_match: 1,
    technician_experience_years: 8,
  },
  'demo-wo-03': {
    schedule_density: 2,
    lead_time_days: 2,
    issue_type_complexity: 0.6,
    technician_skill_match: 0.75,
    technician_experience_years: 6,
  },
  'demo-wo-04': {
    schedule_density: 5,
    lead_time_days: 0.1,
    issue_type_complexity: 0.9,
    technician_skill_match: 0.25,
    technician_experience_years: 3,
  },
  'demo-wo-05': {
    schedule_density: 2,
    lead_time_days: 4,
    issue_type_complexity: 0.5,
    technician_skill_match: 0.6,
    technician_experience_years: 10,
  },
  'demo-wo-06': {
    schedule_density: 1,
    lead_time_days: 7,
    issue_type_complexity: 0.2,
    technician_skill_match: 1,
    technician_experience_years: 15,
  },
};

/** True only when the deployment explicitly opts into demo mode. */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

/**
 * Deterministic lookup. Returns undefined for any work order that is not one
 * of the six seeded demo jobs — the UI then shows no risk chip at all rather
 * than inventing a score.
 */
export function getDemoRisk(workOrderId: string): DemoRisk | undefined {
  return DEMO_RISK[workOrderId];
}

/**
 * Applies the demo stub to a list of work orders. Returns the input unchanged
 * unless the deployment opted into demo mode, and leaves any work order that
 * is not one of the six seeded demo jobs untouched — the UI must not invent a
 * score where the model has none.
 */
export function applyDemoRisk(workOrders: WorkOrder[]): WorkOrder[] {
  if (!isDemoMode()) return workOrders;

  return workOrders.map((workOrder) => {
    // The server's own score wins. The stub fills a gap; it does not override
    // a real prediction, or the demo would silently demonstrate the stub.
    if (workOrder.risk) return workOrder;
    const demoRisk = getDemoRisk(workOrder.id);
    return demoRisk
      ? { ...workOrder, risk: toRiskAssessment(demoRisk, DEMO_FEATURES[workOrder.id]) }
      : workOrder;
  });
}

/**
 * Adapts the demo stub to the shape the surface renders.
 *
 * The range and confidence here are demo approximations, not model output:
 * Phase 4 replaces this whole module and supplies the real bootstrap range
 * (p10/p90) and the out-of-range flag.
 */
export function toRiskAssessment(
  demo: DemoRisk,
  features?: WorkOrderFeatures,
): RiskAssessment {
  const spread = demo.band === 'high' ? 0.09 : demo.band === 'medium' ? 0.14 : 0.07;
  const clamp = (value: number) => Math.min(0.99, Math.max(0.01, value));

  return {
    score: demo.risk,
    confidence: demo.band === 'high' ? 0.82 : demo.band === 'medium' ? 0.64 : 0.91,
    p10: clamp(demo.risk - spread),
    p50: demo.risk,
    p90: clamp(demo.risk + spread),
    outOfRange: false,
    band: demo.band,
    factors: demo.factors.map((factor) => ({
      factor: factor.factor,
      impact: factor.impact,
      plainLanguage: factor.plain_language,
    })),
    features,
  };
}
