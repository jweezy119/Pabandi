import { describe, expect, it } from 'vitest';
import {
  buildPriorHierarchy,
  logistic,
  logit,
  predictAdditiveRisk,
  shrinkPrior,
  verdictForRisk,
  type PriorCounts,
} from '../src/services/riskModel';

/**
 * The shared additive core. Both the coordinator engine and booking risk run on
 * these functions, so a regression here changes two products at once — which is
 * exactly why the properties are pinned rather than spot-checked.
 */
describe('predictAdditiveRisk', () => {
  const base = {
    names: ['a', 'b'] as readonly string[],
    coefficients: [0.5, -0.25] as readonly number[],
    trainingMeans: [10, 4] as readonly number[],
  };

  it('returns the baseline when every feature sits at its training mean', () => {
    const prediction = predictAdditiveRisk({
      ...base,
      values: [10, 4],
      baselineRisk: 0.3,
    });
    expect(prediction.riskScore).toBeCloseTo(0.3, 6);
    expect(prediction.z).toBeCloseTo(logit(0.3), 6);
  });

  it('centres features, so contributions are exact rather than approximated', () => {
    const prediction = predictAdditiveRisk({
      ...base,
      values: [12, 4],
      baselineRisk: 0.3,
    });
    // (12 - 10) * 0.5
    expect(prediction.contributions).toEqual([{ name: 'a', impact: 1 }]);
    expect(prediction.z).toBeCloseTo(logit(0.3) + 1, 6);
  });

  it('sums contributions to the departure from the baseline', () => {
    const prediction = predictAdditiveRisk({
      ...base,
      values: [12, 2],
      baselineRisk: 0.3,
    });
    const total = prediction.contributions.reduce((sum, item) => sum + item.impact, 0);
    expect(total).toBeCloseTo(prediction.z - logit(0.3), 10);
  });

  it('raises the risk for a positive coefficient on an above-average feature', () => {
    const low = predictAdditiveRisk({ ...base, values: [10, 4], baselineRisk: 0.3 });
    const high = predictAdditiveRisk({ ...base, values: [20, 4], baselineRisk: 0.3 });
    expect(high.riskScore).toBeGreaterThan(low.riskScore);
  });

  it('lowers the risk for a negative coefficient on an above-average feature', () => {
    const low = predictAdditiveRisk({ ...base, values: [10, 4], baselineRisk: 0.3 });
    const high = predictAdditiveRisk({ ...base, values: [10, 8], baselineRisk: 0.3 });
    expect(high.riskScore).toBeLessThan(low.riskScore);
  });

  it('omits features with no effect instead of reporting zeros', () => {
    const prediction = predictAdditiveRisk({
      ...base,
      values: [10, 8],
      baselineRisk: 0.3,
    });
    expect(prediction.contributions.map((item) => item.name)).toEqual(['b']);
  });

  it('treats a non-finite value as zero rather than producing NaN', () => {
    const prediction = predictAdditiveRisk({
      ...base,
      values: [Number.NaN, 4],
      baselineRisk: 0.3,
    });
    expect(Number.isFinite(prediction.riskScore)).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const params = { ...base, values: [7, 9], baselineRisk: 0.4 };
    expect(predictAdditiveRisk(params)).toEqual(predictAdditiveRisk(params));
  });
});

describe('verdictForRisk', () => {
  it('bands at the same thresholds the HITL matrix uses', () => {
    expect(verdictForRisk(0.34).band).toBe('low');
    expect(verdictForRisk(0.35).band).toBe('medium');
    expect(verdictForRisk(0.7).band).toBe('medium');
    expect(verdictForRisk(0.71).band).toBe('high');
  });

  it('feeds the score into the HITL policy', () => {
    expect(verdictForRisk(0.05).policy).toBe('AUTONOMOUS');
    expect(verdictForRisk(0.5).policy).toBe('ASSISTED');
    expect(verdictForRisk(0.95).policy).toBe('HUMAN_MANDATORY');
    expect(verdictForRisk(0.95).needsEvidenceBundle).toBe(true);
  });

  it('reports zero confidence at the decision boundary', () => {
    expect(verdictForRisk(0.5).confidence).toBe(0);
  });
});

describe('shared prior maths', () => {
  const parent: { alpha: number; beta: number } = { alpha: 4, beta: 1 };

  it('shrinks a child toward its parent by n / (n + k)', () => {
    const counts: PriorCounts = { onTime: 10, wentWrong: 10 };
    expect(shrinkPrior(counts, parent, 10).weight).toBeCloseTo(20 / 30, 10);
    expect(shrinkPrior({ onTime: 0, wentWrong: 0 }, parent, 10).weight).toBe(0);
  });

  it('threads global into vertical into entity', () => {
    const hierarchy = buildPriorHierarchy({
      global: { onTime: 800, wentWrong: 200 },
      vertical: { onTime: 400, wentWrong: 100 },
      technician: { onTime: 0, wentWrong: 0 },
    });
    // No technician history, so the entity inherits the vertical rate.
    expect(hierarchy.technician.posteriorRisk).toBeCloseTo(
      hierarchy.vertical.posteriorRisk,
      10,
    );
  });

  it('keeps logistic and logit as inverses', () => {
    for (const value of [0.01, 0.3, 0.5, 0.7, 0.99]) {
      expect(logistic(logit(value))).toBeCloseTo(value, 6);
    }
  });
});
